// Seeds common occupations and the 8 Bangladesh divisions with a few sample districts.
const OCCUPATIONS = [
  'ডাক্তার', 'ইঞ্জিনিয়ার', 'শিক্ষকতা', 'অধ্যাপনা', 'এ্যাডভোকেট', 'চাকুরীজীবি',
  'বিশিষ্ট ব্যবসায়ী', 'ব্যাংকার', 'বাংলাদেশ পুলিশ', 'বাংলাদেশ সেনাবাহিনী',
  'বাংলাদেশ নৌবাহিনী', 'জজ', 'দিনমজুর/ শ্রমিক', 'ড্রাইভার', 'কৃষক', 'গৃহিণী', 'ছাত্র/ছাত্রী', 'অন্যান্য',
];

const DIVISIONS = {
  রাজশাহী: ['বগুড়া', 'রাজশাহী', 'নাটোর', 'পাবনা', 'সিরাজগঞ্জ', 'জয়পুরহাট', 'নওগাঁ', 'চাঁপাইনবাবগঞ্জ'],
  ঢাকা: ['ঢাকা', 'গাজীপুর', 'নারায়ণগঞ্জ', 'টাঙ্গাইল', 'কিশোরগঞ্জ', 'মানিকগঞ্জ'],
  চট্টগ্রাম: ['চট্টগ্রাম', 'কক্সবাজার', 'কুমিল্লা', 'ফেনী', 'নোয়াখালী'],
  খুলনা: ['খুলনা', 'যশোর', 'কুষ্টিয়া', 'সাতক্ষীরা'],
  বরিশাল: ['বরিশাল', 'পটুয়াখালী', 'ভোলা', 'ঝালকাঠি'],
  সিলেট: ['সিলেট', 'মৌলভীবাজার', 'হবিগঞ্জ', 'সুনামগঞ্জ'],
  রংপুর: ['রংপুর', 'দিনাজপুর', 'কুড়িগ্রাম', 'গাইবান্ধা', 'নীলফামারী'],
  ময়মনসিংহ: ['ময়মনসিংহ', 'জামালপুর', 'নেত্রকোণা', 'শেরপুর'],
};

exports.seed = async (knex) => {
  if ((await knex('occupations').count('* as c').first()).c == 0) {
    await knex('occupations').insert(OCCUPATIONS.map((name) => ({ name })));
    console.log(`Seeded ${OCCUPATIONS.length} occupations.`);
  }

  if ((await knex('divisions').count('* as c').first()).c == 0) {
    for (const [divName, districts] of Object.entries(DIVISIONS)) {
      const [div] = await knex('divisions').insert({ name: divName }).returning('id');
      const divisionId = div.id || div;
      await knex('districts').insert(districts.map((name) => ({ division_id: divisionId, name })));
    }
    console.log('Seeded divisions and districts.');
  }
};
