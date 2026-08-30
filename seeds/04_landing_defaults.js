exports.seed = async (knex) => {
  // 1. prayer_settings
  const existingPrayer = await knex('prayer_settings').first();
  if (!existingPrayer) {
    await knex('prayer_settings').insert({
      fajr: '04:30',
      dhuhr: '12:15',
      asr: '15:45',
      maghrib: '18:25',
      isha: '19:55',
      jummah: '13:15',
      hijri_date: '17 Dhul-Hijjah 1447',
      venue_name: 'বায়তুর রহমান জামে মসজিদ',
      venue_address: 'ঢাকা, বাংলাদেশ',
      venue_phone: '+880 1234-567890',
    });
    console.log('Seeded default prayer settings.');
  }

  // 2. events
  const existingEvents = await knex('events').first();
  if (!existingEvents) {
    await knex('events').insert([
      {
        title_bn: 'জুম্মার নামাজ',
        title_en: 'Jummah Prayer',
        description_bn: 'সাপ্তাহিক জুম্মার খুতবা ও নামাজ',
        description_en: 'Weekly Friday sermon and prayer',
        category: 'Regular',
        event_date: '2026-06-07',
        event_time: '13:00',
        location: 'মসজিদ প্রাঙ্গণ',
        is_active: true,
      },
      {
        title_bn: 'কুরআন তেলাওয়াত ক্লাস',
        title_en: 'Quran Recitation Class',
        description_bn: 'শিশুদের জন্য সাপ্তাহিক কুরআন শিক্ষা',
        description_en: 'Weekly Quran lessons for children',
        category: 'Education',
        event_date: '2026-06-08',
        event_time: '10:00',
        location: 'মসজিদ সেমিনার রুম',
        is_active: true,
      },
      {
        title_bn: 'সাপ্তাহিক ইফতার',
        title_en: 'Community Iftar',
        description_bn: 'সকল সদস্যের জন্য সাপ্তাহিক ইফতার আয়োজন',
        description_en: 'Open iftar gathering for all members',
        category: 'Community',
        event_date: '2026-06-09',
        event_time: '18:30',
        location: 'মসজিদ ডাইনিং হল',
        is_active: true,
      },
      {
        title_bn: 'কমিটি মিটিং',
        title_en: 'Committee Meeting',
        description_bn: 'মাসিক ব্যবস্থাপনা কমিটির সভা',
        description_en: 'Monthly management committee meeting',
        category: 'Meeting',
        event_date: '2026-06-11',
        event_time: '20:00',
        location: 'অফিস কক্ষ',
        is_active: true,
      },
    ]);
    console.log('Seeded default events.');
  }

  // 3. staff_members
  const existingStaff = await knex('staff_members').first();
  if (!existingStaff) {
    await knex('staff_members').insert([
      {
        name_bn: 'মাওলানা আব্দুর রহমান',
        name_en: 'Maulana Abdur Rahman',
        position_bn: 'প্রধান ইমাম',
        position_en: 'Head Imam',
        bio_bn: '২০ বছরের অভিজ্ঞতা সম্পন্ন আলেম, হাফেজে কুরআন।',
        bio_en: 'Hafiz with 20+ years leading congregational prayer and Islamic guidance.',
        email: 'imam@mosque.com',
        phone: '+880 1234-567890',
        photo: null,
        sort_order: 1,
        is_active: true,
      },
      {
        name_bn: 'মোহাম্মদ ইসমাইল হোসেন',
        name_en: 'Mohammad Ismail Hossain',
        position_bn: 'প্রধান প্রশাসক',
        position_en: 'Head Administrator',
        bio_bn: 'মসজিদ ব্যবস্থাপনা ও সম্প্রদায়িক বিষয়াদির তত্ত্বাবধায়ক।',
        bio_en: 'Oversees daily operations, community programs and administration.',
        email: 'admin@mosque.com',
        phone: '+880 1234-567891',
        photo: null,
        sort_order: 2,
        is_active: true,
      },
      {
        name_bn: 'জনাব ইয়াসিন চৌধুরী',
        name_en: 'Mr. Yasin Chowdhury',
        position_bn: 'কোষাধ্যক্ষ',
        position_en: 'Treasurer',
        bio_bn: 'অর্থনৈতিক স্বচ্ছতা নিশ্চিতকরণ ও হিসাব রক্ষণ।',
        bio_en: 'Ensures full financial transparency and rigorous bookkeeping.',
        email: 'treasurer@mosque.com',
        phone: '+880 1234-567892',
        photo: null,
        sort_order: 3,
        is_active: true,
      },
      {
        name_bn: 'জনাবা আমিনা বেগম',
        name_en: 'Mrs. Amina Begum',
        position_bn: 'অনুষ্ঠান সমন্বয়ক',
        position_en: 'Events Coordinator',
        bio_bn: 'সম্প্রদায়িক অনুষ্ঠান ও মহিলা কর্মসূচির আয়োজন।',
        bio_en: 'Coordinates community events and women\'s programs.',
        email: 'events@mosque.com',
        phone: '+880 1234-567893',
        photo: null,
        sort_order: 4,
        is_active: true,
      },
    ]);
    console.log('Seeded default staff members.');
  }

  // 4. announcements
  const existingAnnouncements = await knex('announcements').first();
  if (!existingAnnouncements) {
    await knex('announcements').insert([
      {
        title_bn: 'জরুরি: পানি সরবরাহ বন্ধ',
        title_en: 'Urgent: Water Supply Disruption',
        content_bn: 'আগামীকাল রক্ষণাবেক্ষণের কারণে সকাল ১০টা থেকে দুপুর ২টা পর্যন্ত পানি সরবরাহ বন্ধ থাকবে।',
        content_en: 'Water supply will be off from 10AM to 2PM tomorrow due to maintenance work.',
        category: 'emergency',
        publish_date: '2026-05-28',
        is_active: true,
      },
      {
        title_bn: 'ঈদ-উল-আযহার বিশেষ আয়োজন',
        title_en: 'Eid-ul-Adha Special Programs',
        content_bn: 'ঈদের জামাত এবং কুরবানীর ব্যবস্থা সংক্রান্ত বিস্তারিত তথ্য জানুন।',
        content_en: 'Find full details on Eid prayer congregation and qurbani arrangements.',
        category: 'event',
        publish_date: '2026-05-26',
        is_active: true,
      },
      {
        title_bn: 'মাসিক কমিটি সভা',
        title_en: 'Monthly Committee Meeting',
        content_bn: '১১ জুন রাত ৮টায় মসজিদ মিলনায়তনে অনুষ্ঠিত হবে। সকল সদস্য আমন্ত্রিত।',
        content_en: 'Will be held on June 11 at 8PM in the mosque hall. All members welcome.',
        category: 'meeting',
        publish_date: '2026-05-25',
        is_active: true,
      },
      {
        title_bn: 'নতুন কুরআন ক্লাস শুরু',
        title_en: 'New Quran Classes Starting',
        content_bn: 'শিশু ও প্রাপ্তবয়স্কদের জন্য নতুন ব্যাচ শুরু হচ্ছে ১৫ জুন থেকে।',
        content_en: 'New batches for children and adults beginning June 15.',
        category: 'general',
        publish_date: '2026-05-24',
        is_active: true,
      },
      {
        title_bn: 'সাপ্তাহিক ইফতার আয়োজন',
        title_en: 'Weekly Iftar Gathering',
        content_bn: 'প্রতি শনিবার সাপ্তাহিক ইফতার সকল সদস্যের জন্য উন্মুক্ত।',
        content_en: 'Weekly community iftar every Saturday, open to all members.',
        category: 'event',
        publish_date: '2026-05-22',
        is_active: true,
      },
    ]);
    console.log('Seeded default announcements.');
  }

  // 5. gallery_images
  const existingGallery = await knex('gallery_images').first();
  if (!existingGallery) {
    await knex('gallery_images').insert([
      { title_bn: 'মসজিদের সম্মুখ', title_en: 'Mosque Exterior', image_path: 'https://images.unsplash.com/photo-1597935258735-e254c1839512?q=80&w=800', category: 'Building', sort_order: 1, is_active: true },
      { title_bn: 'নামাজের হল', title_en: 'Prayer Hall', image_path: 'https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=800', category: 'Prayer', sort_order: 2, is_active: true },
      { title_bn: 'ইফতার আয়োজন', title_en: 'Iftar Gathering', image_path: 'https://images.unsplash.com/photo-1564507592333-c60657eea523?q=80&w=800', category: 'Events', sort_order: 3, is_active: true },
      { title_bn: 'মিনার', title_en: 'Minaret View', image_path: 'https://images.unsplash.com/photo-1597935258735-e254c1839512?q=80&w=800', category: 'Building', sort_order: 4, is_active: true },
      { title_bn: 'মিহরাব', title_en: 'Mihrab', image_path: 'https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=800', category: 'Prayer', sort_order: 5, is_active: true },
      { title_bn: 'খাদ্য বিতরণ', title_en: 'Food Distribution', image_path: 'https://images.unsplash.com/photo-1564507592333-c60657eea523?q=80&w=800', category: 'Charity', sort_order: 6, is_active: true },
      { title_bn: 'কুরআন ক্লাস', title_en: 'Quran Class', image_path: 'https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=800', category: 'Education', sort_order: 7, is_active: true },
      { title_bn: 'ঈদ জামাত', title_en: 'Eid Congregation', image_path: 'https://images.unsplash.com/photo-1564507592333-c60657eea523?q=80&w=800', category: 'Events', sort_order: 8, is_active: true },
    ]);
    console.log('Seeded default gallery images.');
  }

  // 6. faqs
  const existingFaqs = await knex('faqs').first();
  if (!existingFaqs) {
    await knex('faqs').insert([
      {
        question_bn: 'আমি কীভাবে সদস্য হতে পারি?',
        question_en: 'How do I become a member?',
        answer_bn: 'মসজিদ অফিসে এসে অথবা যোগাযোগ ফর্ম পূরণ করে আবেদন করতে পারেন। ফি ও বিস্তারিত প্রশাসকের কাছে জানতে পারবেন।',
        answer_en: 'Visit the mosque office or submit the contact form. Our administrator will share fees and details.',
        sort_order: 1,
        is_active: true,
      },
      {
        question_bn: 'আমি কি অনুষ্ঠানের জন্য মসজিদ ভাড়া নিতে পারি?',
        question_en: 'Can I rent the mosque for events?',
        answer_bn: 'হ্যাঁ, বিবাহ, আকীকা ও অন্যান্য আয়োজনের জন্য মিলনায়তন বুকিং করা যায়। বিস্তারিত যোগাযোগ ফর্মে জানান।',
        answer_en: 'Yes, our hall is available for weddings, aqiqah, and community events. Use the contact form for booking details.',
        sort_order: 2,
        is_active: true,
      },
      {
        question_bn: 'আমি কীভাবে স্বেচ্ছাসেবক হতে পারি?',
        question_en: 'How can I volunteer?',
        answer_bn: 'শিক্ষা, ইফতার আয়োজন, পরিচ্ছন্নতা সহ বিভিন্ন বিভাগে আমাদের স্বেচ্ছাসেবকদের প্রয়োজন। যোগাযোগ করুন।',
        answer_en: 'We always welcome volunteers for education, iftar arrangements, cleaning, and more. Reach out to us.',
        sort_order: 3,
        is_active: true,
      },
      {
        question_bn: 'নামাজের সময় কোথায় পাব?',
        question_en: 'Where can I find prayer times?',
        answer_bn: 'এই পেইজের \'নামাজের সময়\' সেকশনে সকল ওয়াক্তের সময় এবং পরবর্তী নামাজের কাউন্টডাউন দেখানো হয়।',
        answer_en: 'Check the Prayer Times section above for all five daily prayers and a live countdown to the next prayer.',
        sort_order: 4,
        is_active: true,
      },
      {
        question_bn: 'দান কীভাবে ব্যবহার করা হয়?',
        question_en: 'How are donations used?',
        answer_bn: '১০০% দান মসজিদ রক্ষণাবেক্ষণ, শিক্ষা এবং সম্প্রদায়িক সেবায় ব্যবহৃত হয়। স্বচ্ছতার জন্য মাসিক হিসাব প্রকাশিত হয়।',
        answer_en: '100% of donations support mosque maintenance, education, and community services. Monthly transparency reports are published.',
        sort_order: 5,
        is_active: true,
      },
      {
        question_bn: 'যাকাত কি গ্রহণ করা হয়?',
        question_en: 'Are zakat donations accepted?',
        answer_bn: 'হ্যাঁ, আমরা শরিয়াহ অনুযায়ী যাকাত গ্রহণ ও বিতরণ করি। দান ফর্মে \'যাকাত\' সিলেক্ট করুন।',
        answer_en: 'Yes, we accept and distribute zakat in accordance with Shariah. Select \'Zakat\' in the donation form.',
        sort_order: 6,
        is_active: true,
      },
    ]);
    console.log('Seeded default FAQs.');
  }

  // 7. janaza_notices
  const existingJanaza = await knex('janaza_notices').first();
  if (!existingJanaza) {
    await knex('janaza_notices').insert([
      {
        deceased_name_bn: 'মরহুম আব্দুল করিম',
        deceased_name_en: 'Marhum Abdul Karim',
        janaza_date: '2026-05-30',
        janaza_time: 'বাদ আসর',
        location_bn: 'মসজিদ প্রাঙ্গণ',
        location_en: 'Mosque Prayer Hall',
        message_bn: 'আল্লাহ তাঁকে জান্নাতুল ফিরদাউস নসিব করুন। ইন্না লিল্লাহি ওয়া ইন্না ইলাইহি রাজিউন।',
        message_en: 'May Allah grant him Jannatul Firdaus. Inna lillahi wa inna ilayhi raji\'un.',
        is_active: true,
      },
      {
        deceased_name_bn: 'মরহুমা রোকেয়া বেগম',
        deceased_name_en: 'Marhuma Rokeya Begum',
        janaza_date: '2026-05-27',
        janaza_time: 'বাদ যোহর',
        location_bn: 'মসজিদ প্রাঙ্গণ',
        location_en: 'Mosque Prayer Hall',
        message_bn: 'আল্লাহ তাঁর সকল গুনাহ মাফ করে দিন।',
        message_en: 'May Allah forgive all her sins and grant her Paradise.',
        is_active: true,
      },
    ]);
    console.log('Seeded default Janaza notices.');
  }
};
