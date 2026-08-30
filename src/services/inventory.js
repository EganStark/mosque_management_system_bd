const db = require("../config/db");
async function options() {
  return {
    categories: await db("inventory_categories")
      .where({ is_active: true })
      .orderBy("name"),
    staff: await db("staff_members")
      .where({ is_active: true })
      .whereNot({ employment_status: "left" })
      .select("id", "name_bn", "position_bn")
      .orderBy("sort_order"),
    facilities: await db("facilities")
      .where({ is_active: true })
      .orderBy("name"),
    programs: await db("mosque_programs")
      .where({ status: "active" })
      .orderBy("name"),
    receipts: await db("goods_receipts as g")
      .join("purchase_orders as o", "g.purchase_order_id", "o.id")
      .join("maintenance_vendors as v", "o.vendor_id", "v.id")
      .select(
        "g.id",
        "g.receipt_no",
        "g.received_date",
        "o.order_no",
        "v.name as vendor_name",
      )
      .where("g.condition_status", "accepted")
      .orderBy("g.id", "desc"),
  };
}
async function summary() {
  const r = await db("inventory_items")
    .where({ is_active: true })
    .first(
      db.raw("COUNT(*)::int items"),
      db.raw("COUNT(*) FILTER(WHERE stock_quantity<=reorder_level)::int low"),
      db.raw("COALESCE(SUM(stock_quantity*average_unit_cost),0) value"),
    );
  const i = await db("inventory_movements")
    .where({ movement_type: "issue" })
    .where("movement_date", ">=", db.raw("date_trunc('month',CURRENT_DATE)"))
    .select(db.raw("COALESCE(SUM(ABS(quantity)),0) as total"))
    .first();
  return {
    items: Number(r.items || 0),
    low: Number(r.low || 0),
    value: Number(r.value || 0),
    issued: Number(i.total || 0),
  };
}
async function list() {
  return db("inventory_items as i")
    .leftJoin("inventory_categories as c", "i.category_id", "c.id")
    .select("i.*", "c.name as category_name")
    .where("i.is_active", true)
    .orderByRaw("CASE WHEN i.stock_quantity<=i.reorder_level THEN 0 ELSE 1 END")
    .orderBy("i.name");
}
async function create(data, userId) {
  const seq = (await db.raw("SELECT nextval('inventory_item_code_seq') value"))
    .rows[0].value;
  return (
    await db("inventory_items")
      .insert({
        item_code: `STK-${String(seq).padStart(6, "0")}`,
        category_id: data.category_id || null,
        name: data.name,
        description: data.description || null,
        unit: data.unit,
        storage_location: data.storage_location || null,
        reorder_level: data.reorder_level || 0,
        reorder_quantity: data.reorder_quantity || 0,
        created_by: userId,
      })
      .returning("*")
  )[0];
}
async function find(id) {
  const item = await db("inventory_items as i")
    .leftJoin("inventory_categories as c", "i.category_id", "c.id")
    .select("i.*", "c.name as category_name")
    .where("i.id", id)
    .first();
  if (!item) return null;
  item.movements = await db("inventory_movements as m")
    .leftJoin("staff_members as s", "m.issued_to_staff_id", "s.id")
    .leftJoin("facilities as f", "m.facility_id", "f.id")
    .leftJoin("mosque_programs as p", "m.program_id", "p.id")
    .leftJoin("goods_receipts as g", "m.goods_receipt_id", "g.id")
    .leftJoin("users as u", "m.recorded_by", "u.id")
    .select(
      "m.*",
      "s.name_bn as staff_name",
      "f.name as facility_name",
      "p.name as program_name",
      "g.receipt_no",
      "u.name as recorder_name",
    )
    .where("m.item_id", id)
    .orderBy("m.movement_date", "desc")
    .orderBy("m.id", "desc");
  return item;
}
async function move(id, type, data, userId) {
  return db.transaction(async (trx) => {
    const item = await trx("inventory_items")
      .where({ id, is_active: true })
      .forUpdate()
      .first();
    if (!item) throw new Error("Stock item not found");
    let quantity = Number(data.quantity),
      cost = Number(data.unit_cost || 0);
    if (!Number.isFinite(quantity) || quantity <= 0)
      throw new Error("Quantity must be greater than zero");
    let next,
      avg = Number(item.average_unit_cost);
    if (type === "receipt") {
      if (data.goods_receipt_id) {
        const receipt = await trx("goods_receipts")
          .where({
            id: data.goods_receipt_id,
            condition_status: "accepted",
          })
          .first();
        if (!receipt) throw new Error("Select an accepted goods receipt");
      }
      next = Number(item.stock_quantity) + quantity;
      if (cost < 0 || !Number.isFinite(cost))
        throw new Error("Unit cost is invalid");
      avg =
        next > 0
          ? (Number(item.stock_quantity) * avg + quantity * cost) / next
          : 0;
    } else if (type === "issue") {
      if (quantity > Number(item.stock_quantity))
        throw new Error("Issue quantity exceeds available stock");
      quantity = -quantity;
      next = Number(item.stock_quantity) + quantity;
    } else throw new Error("Invalid movement");
    const seq = (
      await trx.raw("SELECT nextval('inventory_movement_ref_seq') value")
    ).rows[0].value;
    const movement = (
      await trx("inventory_movements")
        .insert({
          reference_no: `MOV-${new Date().getFullYear()}-${String(seq).padStart(7, "0")}`,
          item_id: id,
          movement_type: type,
          quantity,
          balance_after: next,
          unit_cost: type === "receipt" ? cost : avg,
          movement_date: data.movement_date,
          goods_receipt_id:
            type === "receipt" ? data.goods_receipt_id || null : null,
          issued_to_staff_id:
            type === "issue" ? data.issued_to_staff_id || null : null,
          facility_id: type === "issue" ? data.facility_id || null : null,
          program_id: type === "issue" ? data.program_id || null : null,
          recipient_name: data.recipient_name || null,
          external_reference: data.external_reference || null,
          notes: data.notes || null,
          recorded_by: userId,
        })
        .returning("*")
    )[0];
    await trx("inventory_items")
      .where({ id })
      .update({
        stock_quantity: next,
        average_unit_cost: avg,
        updated_at: trx.fn.now(),
      });
    return movement;
  });
}
async function adjust(id, data, userId) {
  return db.transaction(async (trx) => {
    const item = await trx("inventory_items")
      .where({ id, is_active: true })
      .forUpdate()
      .first();
    if (!item) throw new Error("Stock item not found");
    const counted = Number(data.counted_quantity);
    if (!Number.isFinite(counted) || counted < 0)
      throw new Error("Counted quantity is invalid");
    const difference = counted - Number(item.stock_quantity);
    if (difference === 0) throw new Error("No stock difference to adjust");
    const seq = (
      await trx.raw("SELECT nextval('inventory_movement_ref_seq') value")
    ).rows[0].value;
    await trx("inventory_movements").insert({
      reference_no: `MOV-${new Date().getFullYear()}-${String(seq).padStart(7, "0")}`,
      item_id: id,
      movement_type: "adjustment",
      quantity: difference,
      balance_after: counted,
      unit_cost: item.average_unit_cost,
      movement_date: data.movement_date,
      notes: data.notes,
      recorded_by: userId,
    });
    await trx("inventory_items")
      .where({ id })
      .update({ stock_quantity: counted, updated_at: trx.fn.now() });
  });
}
module.exports = { options, summary, list, create, find, move, adjust };
