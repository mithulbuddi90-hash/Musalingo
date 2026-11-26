(function bootstrapQuestions() {
    'use strict';

    const audienceData = globalThis.MusalingoAudience || {
        languageCodes: { English: 'en', Spanish: 'es', French: 'fr', Japanese: 'ja', Hindi: 'hi' },
        languageNames: {},
        translations: {},
        hints: {},
        catalogGroups: []
    };

    // ═══════════════════════════════════════════════════════════════════
    //  VOCABULARY BANKS
    //  Each language has a vocab map keyed by topic (matching curriculum)
    //  plus a flat LANGUAGE_SAMPLES array for the basic MC/listen/spell
    //  question types. The translate bank adds richer sentence data.
    // ═══════════════════════════════════════════════════════════════════

    const ENGLISH_TRANSLATIONS = {
        English: { Hello: 'hello', Goodbye: 'goodbye', Book: 'book', Happy: 'happy', 'Thank you': 'thank you', Friend: 'friend', Water: 'water', House: 'house', Please: 'please', School: 'school' },
        Japanese: { 'こんにちは': 'hello', 'ありがとう': 'thank you', '学校': 'school', '猫': 'cat', '水': 'water', '友達': 'friend', '本': 'book', '食べ物': 'food', '家': 'home', '朝': 'morning', '車': 'car', '音楽': 'music', '夜': 'night', '雨': 'rain', '元気': 'well', 'おはよう': 'good morning', 'こんばんは': 'good evening', 'さようなら': 'goodbye', 'すみません': 'excuse me', '犬': 'dog', '魚': 'fish', 'パン': 'bread', 'ごはん': 'rice/meal', '電車': 'train', 'バス': 'bus', '駅': 'station', '病院': 'hospital', '薬局': 'pharmacy', 'トイレ': 'toilet', '右': 'right', '左': 'left', '高い': 'expensive', '安い': 'cheap', '大きい': 'big', '小さい': 'small', '熱い': 'hot', '冷たい': 'cold', '新しい': 'new', '古い': 'old' },
        Spanish: { hola: 'hello', adios: 'goodbye', libro: 'book', feliz: 'happy', gracias: 'thank you', 'por favor': 'please', amigo: 'friend', agua: 'water', mesa: 'table', casa: 'house', escuela: 'school', manzana: 'apple', correr: 'run', puerta: 'door', sol: 'sun', gato: 'cat', perro: 'dog', comida: 'food', leche: 'milk', pan: 'bread', carne: 'meat', fruta: 'fruit', tienda: 'store', mercado: 'market', calle: 'street', ciudad: 'city', pais: 'country', trabajo: 'work', familia: 'family', madre: 'mother', padre: 'father', hijo: 'son', hija: 'daughter', hermano: 'brother', hermana: 'sister', rojo: 'red', azul: 'blue', verde: 'green', grande: 'big', pequeño: 'small', bueno: 'good', malo: 'bad', rapido: 'fast', lento: 'slow', hoy: 'today', mañana: 'tomorrow', ayer: 'yesterday' },
        French: { bonjour: 'hello', merci: 'thank you', livre: 'book', maison: 'house', ami: 'friend', eau: 'water', porte: 'door', soleil: 'sun', ecole: 'school', pomme: 'apple', voiture: 'car', chat: 'cat', chien: 'dog', pain: 'bread', lait: 'milk', fromage: 'cheese', rue: 'street', ville: 'city', famille: 'family', mere: 'mother', pere: 'father', frere: 'brother', soeur: 'sister', rouge: 'red', bleu: 'blue', grand: 'big', petit: 'small', bon: 'good', mauvais: 'bad', aujourd: 'today', demain: 'tomorrow', hier: 'yesterday', beau: 'beautiful', travail: 'work' },
        German: { hallo: 'hello', danke: 'thank you', buch: 'book', freund: 'friend', wasser: 'water', schule: 'school', haus: 'house', tafel: 'table', musik: 'music', apfel: 'apple', laufen: 'run', sonne: 'sun', tur: 'door', katze: 'cat', hund: 'dog', brot: 'bread', milch: 'milk', kase: 'cheese', strasse: 'street', stadt: 'city', familie: 'family', mutter: 'mother', vater: 'father', bruder: 'brother', schwester: 'sister', rot: 'red', blau: 'blue', gross: 'big', klein: 'small', gut: 'good', schlecht: 'bad', heute: 'today', morgen: 'tomorrow', gestern: 'yesterday' },
        Italian: { ciao: 'hello', grazie: 'thank you', libro: 'book', amico: 'friend', acqua: 'water', scuola: 'school', casa: 'house', mela: 'apple', musica: 'music', porta: 'door', sole: 'sun', corre: 'run', gatto: 'cat', cane: 'dog', pane: 'bread', latte: 'milk', formaggio: 'cheese', via: 'street', citta: 'city', famiglia: 'family', madre: 'mother', padre: 'father', fratello: 'brother', sorella: 'sister', rosso: 'red', blu: 'blue', grande: 'big', piccolo: 'small', buono: 'good', cattivo: 'bad', oggi: 'today', domani: 'tomorrow', ieri: 'yesterday' },
        Arabic: { 'مرحبا': 'hello', 'شكرا': 'thank you', 'كتاب': 'book', 'بيت': 'house', 'ماء': 'water', 'صديق': 'friend', 'مدرسة': 'school', 'نافذة': 'window', 'قمر': 'moon', 'تفاحة': 'apple', 'أحب': 'love', 'سماء': 'sky', 'باب': 'door', 'شمس': 'sun', 'قطة': 'cat', 'كلب': 'dog', 'خبز': 'bread', 'حليب': 'milk', 'شارع': 'street', 'مدينة': 'city', 'عائلة': 'family', 'أم': 'mother', 'أب': 'father', 'أخ': 'brother', 'أخت': 'sister', 'أحمر': 'red', 'أزرق': 'blue', 'كبير': 'big', 'صغير': 'small', 'جيد': 'good', 'سيء': 'bad', 'اليوم': 'today', 'غدا': 'tomorrow', 'أمس': 'yesterday' },
        Hindi: { 'नमस्ते': 'hello', 'धन्यवाद': 'thank you', 'किताब': 'book', 'मित्र': 'friend', 'पानी': 'water', 'विद्यालय': 'school', 'घर': 'house', 'दरवाज़ा': 'door', 'सूरज': 'sun', 'सेब': 'apple', 'दोस्ती': 'friendship', 'आकाश': 'sky', 'चाँद': 'moon', 'बिल्ली': 'cat', 'कुत्ता': 'dog', 'रोटी': 'bread', 'दूध': 'milk', 'सड़क': 'street', 'शहर': 'city', 'परिवार': 'family', 'माँ': 'mother', 'पिता': 'father', 'भाई': 'brother', 'बहन': 'sister', 'लाल': 'red', 'नीला': 'blue', 'बड़ा': 'big', 'छोटा': 'small', 'अच्छा': 'good', 'बुरा': 'bad', 'आज': 'today', 'कल': 'tomorrow', 'कल (बीता)': 'yesterday' },
        Korean: { '안녕하세요': 'hello', '고맙습니다': 'thank you', '책': 'book', '친구': 'friend', '물': 'water', '학교': 'school', '집': 'house', '문': 'door', '해': 'sun', '고양이': 'cat', '개': 'dog', '빵': 'bread', '우유': 'milk', '길': 'street', '도시': 'city', '가족': 'family', '어머니': 'mother', '아버지': 'father', '형': 'brother', '언니': 'sister', '빨간': 'red', '파란': 'blue', '큰': 'big', '작은': 'small', '좋은': 'good', '나쁜': 'bad', '오늘': 'today', '내일': 'tomorrow', '어제': 'yesterday' },
        Telugu: { 'నమస్కారం': 'hello', 'హలో': 'hello', 'ధన్యవాదాలు': 'thank you', 'పుస్తకం': 'book', 'స్నేహితుడు': 'friend', 'నీళ్ళు': 'water', 'పాఠశాల': 'school', 'ఇల్లు': 'house', 'తలుపు': 'door', 'సూర్యుడు': 'sun', 'పిల్లి': 'cat', 'కుక్క': 'dog', 'రొట్టె': 'bread', 'పాలు': 'milk', 'వీధి': 'street', 'నగరం': 'city', 'కుటుంబం': 'family', 'అమ్మ': 'mother', 'నాన్న': 'father', 'అన్న': 'brother', 'చెల్లి': 'sister', 'ఎరుపు': 'red', 'నీలం': 'blue', 'పెద్ద': 'big', 'చిన్న': 'small', 'మంచి': 'good', 'చెడు': 'bad', 'ఈ రోజు': 'today', 'రేపు': 'tomorrow', 'నిన్న': 'yesterday' }
    };

    // ═══════════════════════════════════════════════════════════════════
    //  LANGUAGE_SAMPLES  — [phrase, answer, distractors, pronunciation]
    //  Used by multiple-choice / listen / spell / speak question types.
    // ═══════════════════════════════════════════════════════════════════

    const LANGUAGE_SAMPLES = {
        English: [
            ['Hello', 'Hello', ['Goodbye', 'Book', 'Happy'], 'hello'],
            ['Thank you', 'Thank you', ['Friend', 'Water', 'House'], 'thank you'],
            ['Please', 'Please', ['Hello', 'School', 'Book'], 'please'],
            ['School', 'School', ['Happy', 'Friend', 'Goodbye'], 'school'],
            ['Book', 'Book', ['Water', 'Please', 'House'], 'book'],
            ['Friend', 'Friend', ['Hello', 'Book', 'School'], 'friend'],
            ['Water', 'Water', ['House', 'Please', 'Happy'], 'water'],
            ['Goodbye', 'Goodbye', ['Hello', 'Thank you', 'Please'], 'goodbye'],
            ['Happy', 'Happy', ['Sad', 'Angry', 'Tired'], 'happy'],
            ['House', 'House', ['School', 'Book', 'Friend'], 'house']
        ],
        Japanese: [
            ['こんにちは', 'こんにちは', ['ありがとう', '学校', '猫'], 'konnichiwa'],
            ['ありがとう', 'ありがとう', ['水', '友達', '本'], 'arigatou'],
            ['学校', '学校', ['食べ物', '家', '朝'], 'gakkou'],
            ['友達', '友達', ['車', '音楽', '夜'], 'tomodachi'],
            ['本', '本', ['水', '雨', '元気'], 'hon'],
            ['おはよう', 'おはよう', ['こんにちは', 'こんばんは', 'さようなら'], 'ohayou'],
            ['こんばんは', 'こんばんは', ['おはよう', 'ありがとう', 'すみません'], 'konbanwa'],
            ['すみません', 'すみません', ['ありがとう', 'こんにちは', 'さようなら'], 'sumimasen'],
            ['犬', '犬', ['猫', '魚', '鳥'], 'inu'],
            ['電車', '電車', ['バス', '車', '駅'], 'densha']
        ],
        Spanish: [
            ['hola', 'hola', ['adios', 'libro', 'feliz'], 'hello'],
            ['gracias', 'gracias', ['por favor', 'amigo', 'agua'], 'thank you'],
            ['amigo', 'amigo', ['mesa', 'agua', 'casa'], 'friend'],
            ['escuela', 'escuela', ['manzana', 'feliz', 'correr'], 'school'],
            ['libro', 'libro', ['puerta', 'hola', 'sol'], 'book'],
            ['gato', 'gato', ['perro', 'pez', 'pajaro'], 'cat'],
            ['familia', 'familia', ['trabajo', 'ciudad', 'pais'], 'family'],
            ['mañana', 'mañana', ['hoy', 'ayer', 'noche'], 'tomorrow'],
            ['grande', 'grande', ['pequeño', 'rojo', 'bueno'], 'big'],
            ['comida', 'comida', ['bebida', 'fruta', 'carne'], 'food']
        ],
        French: [
            ['bonjour', 'bonjour', ['merci', 'livre', 'maison'], 'hello'],
            ['merci', 'merci', ['ami', 'eau', 'maison'], 'thank you'],
            ['ami', 'ami', ['livre', 'porte', 'soleil'], 'friend'],
            ['ecole', 'ecole', ['pomme', 'ami', 'voiture'], 'school'],
            ['livre', 'livre', ['porte', 'bonjour', 'maison'], 'book'],
            ['chat', 'chat', ['chien', 'oiseau', 'poisson'], 'cat'],
            ['famille', 'famille', ['travail', 'ville', 'rue'], 'family'],
            ['demain', 'demain', ["aujourd'hui", 'hier', 'soir'], 'tomorrow'],
            ['grand', 'grand', ['petit', 'rouge', 'bon'], 'big'],
            ['pain', 'pain', ['lait', 'fromage', 'beurre'], 'bread']
        ],
        German: [
            ['hallo', 'hallo', ['danke', 'buch', 'freund'], 'hello'],
            ['danke', 'danke', ['wasser', 'schule', 'haus'], 'thank you'],
            ['freund', 'freund', ['buch', 'tafel', 'musik'], 'friend'],
            ['schule', 'schule', ['apfel', 'laufen', 'sonne'], 'school'],
            ['buch', 'buch', ['tur', 'hallo', 'musik'], 'book'],
            ['katze', 'katze', ['hund', 'vogel', 'fisch'], 'cat'],
            ['familie', 'familie', ['arbeit', 'stadt', 'strasse'], 'family'],
            ['morgen', 'morgen', ['heute', 'gestern', 'nacht'], 'tomorrow'],
            ['gross', 'gross', ['klein', 'rot', 'gut'], 'big'],
            ['brot', 'brot', ['milch', 'kase', 'butter'], 'bread']
        ],
        Italian: [
            ['ciao', 'ciao', ['grazie', 'libro', 'amico'], 'hello'],
            ['grazie', 'grazie', ['acqua', 'scuola', 'casa'], 'thank you'],
            ['amico', 'amico', ['mela', 'musica', 'porta'], 'friend'],
            ['scuola', 'scuola', ['mela', 'corre', 'sole'], 'school'],
            ['libro', 'libro', ['porta', 'ciao', 'sole'], 'book'],
            ['gatto', 'gatto', ['cane', 'uccello', 'pesce'], 'cat'],
            ['famiglia', 'famiglia', ['lavoro', 'citta', 'via'], 'family'],
            ['domani', 'domani', ['oggi', 'ieri', 'sera'], 'tomorrow'],
            ['grande', 'grande', ['piccolo', 'rosso', 'buono'], 'big'],
            ['pane', 'pane', ['latte', 'formaggio', 'burro'], 'bread']
        ],
        Arabic: [
            ['مرحبا', 'مرحبا', ['شكرا', 'كتاب', 'بيت'], 'marhaba'],
            ['شكرا', 'شكرا', ['ماء', 'صديق', 'مدرسة'], 'shukran'],
            ['صديق', 'صديق', ['كتاب', 'نافذة', 'قمر'], 'sadiq'],
            ['مدرسة', 'مدرسة', ['تفاحة', 'أحب', 'سماء'], 'madrasa'],
            ['كتاب', 'كتاب', ['باب', 'مرحبا', 'شمس'], 'kitab'],
            ['قطة', 'قطة', ['كلب', 'طائر', 'سمكة'], 'qitta'],
            ['عائلة', 'عائلة', ['عمل', 'مدينة', 'شارع'], 'aaila'],
            ['غدا', 'غدا', ['اليوم', 'أمس', 'ليلة'], 'ghadan'],
            ['كبير', 'كبير', ['صغير', 'أحمر', 'جيد'], 'kabir'],
            ['خبز', 'خبز', ['حليب', 'جبن', 'زبدة'], 'khubz']
        ],
        Hindi: [
            ['नमस्ते', 'नमस्ते', ['धन्यवाद', 'किताब', 'मित्र'], 'namaste'],
            ['धन्यवाद', 'धन्यवाद', ['पानी', 'विद्यालय', 'घर'], 'dhanyavaad'],
            ['मित्र', 'मित्र', ['किताब', 'दरवाज़ा', 'सूरज'], 'mitra'],
            ['विद्यालय', 'विद्यालय', ['सेब', 'दोस्ती', 'आकाश'], 'vidyalaya'],
            ['किताब', 'किताब', ['दरवाज़ा', 'नमस्ते', 'चाँद'], 'kitab'],
            ['बिल्ली', 'बिल्ली', ['कुत्ता', 'पक्षी', 'मछली'], 'billi'],
            ['परिवार', 'परिवार', ['काम', 'शहर', 'सड़क'], 'parivaar'],
            ['कल', 'कल', ['आज', 'बीता कल', 'रात'], 'kal'],
            ['बड़ा', 'बड़ा', ['छोटा', 'लाल', 'अच्छा'], 'bada'],
            ['रोटी', 'रोटी', ['दूध', 'पनीर', 'मक्खन'], 'roti']
        ],
        Korean: [
            ['안녕하세요', '안녕하세요', ['고맙습니다', '책', '친구'], 'annyeonghaseyo'],
            ['고맙습니다', '고맙습니다', ['물', '학교', '집'], 'gomapseumnida'],
            ['친구', '친구', ['책', '문', '해'], 'chingu'],
            ['학교', '학교', ['집', '물', '안녕하세요'], 'hakgyo'],
            ['책', '책', ['문', '해', '고맙습니다'], 'chaek'],
            ['고양이', '고양이', ['개', '새', '물고기'], 'goyangi'],
            ['가족', '가족', ['일', '도시', '길'], 'gajok'],
            ['내일', '내일', ['오늘', '어제', '밤'], 'naeil'],
            ['큰', '큰', ['작은', '빨간', '좋은'], 'keun'],
            ['빵', '빵', ['우유', '치즈', '버터'], 'ppang']
        ],
        Telugu: [
            ['నమస్కారం', 'నమస్కారం', ['ధన్యవాదాలు', 'పుస్తకం', 'స్నేహితుడు'], 'namaskaram'],
            ['ధన్యవాదాలు', 'ధన్యవాదాలు', ['నీళ్ళు', 'పాఠశాల', 'ఇల్లు'], 'dhanyavaadaalu'],
            ['స్నేహితుడు', 'స్నేహితుడు', ['పుస్తకం', 'తలుపు', 'సూర్యుడు'], 'snehitudu'],
            ['పాఠశాల', 'పాఠశాల', ['ఇల్లు', 'నీళ్ళు', 'నమస్కారం'], 'paathashaala'],
            ['పుస్తకం', 'పుస్తకం', ['తలుపు', 'సూర్యుడు', 'ధన్యవాదాలు'], 'pustakam'],
            ['పిల్లి', 'పిల్లి', ['కుక్క', 'పక్షి', 'చేప'], 'pilli'],
            ['కుటుంబం', 'కుటుంబం', ['పని', 'నగరం', 'వీధి'], 'kutumbam'],
            ['రేపు', 'రేపు', ['ఈ రోజు', 'నిన్న', 'రాత్రి'], 'repu'],
            ['పెద్ద', 'పెద్ద', ['చిన్న', 'ఎరుపు', 'మంచి'], 'pedda'],
            ['రొట్టె', 'రొట్టె', ['పాలు', 'చీజ్', 'వెన్న'], 'rotte']
        ]
    };

    // ═══════════════════════════════════════════════════════════════════
    //  TRANSLATE BANKS
    //  Per Part 8: each entry is a translate question with optional
    //  wordBank. Direction: en_to_target or target_to_en.
    //  wordBank must include every word needed to form the answer plus
    //  2–4 distractors. Omit wordBank for sentences > ~10 words.
    // ═══════════════════════════════════════════════════════════════════

    const TRANSLATE_BANKS = {
        Japanese: {
            greetings: [
                {
                    direction: 'en_to_jp',
                    prompt: 'Translate to Japanese:',
                    phrase: 'Good morning',
                    answer: 'おはようございます',
                    acceptedAnswers: ['おはようございます', 'おはよう'],
                    wordBank: ['おはよう', 'ございます', 'こんにちは', 'さようなら'],
                    hint: 'The polite form of good morning in Japanese.'
                },
                {
                    direction: 'jp_to_en',
                    prompt: 'What does this mean in English?',
                    phrase: 'こんばんは',
                    answer: 'good evening',
                    acceptedAnswers: ['good evening', 'good night'],
                    wordBank: ['good', 'evening', 'morning', 'night', 'hello'],
                    hint: 'A Japanese greeting used after sunset.'
                },
                {
                    direction: 'jp_to_en',
                    prompt: 'What does this mean in English?',
                    phrase: 'はじめまして',
                    answer: 'nice to meet you',
                    acceptedAnswers: ['nice to meet you', 'pleased to meet you'],
                    wordBank: ['nice', 'to', 'meet', 'you', 'hello', 'goodbye'],
                    hint: 'Said when meeting someone for the first time.'
                },
                {
                    direction: 'en_to_jp',
                    prompt: 'Translate to Japanese:',
                    phrase: 'Excuse me',
                    answer: 'すみません',
                    acceptedAnswers: ['すみません', 'すいません'],
                    wordBank: ['すみません', 'ありがとう', 'こんにちは', 'どうぞ'],
                    hint: 'Used to get attention or apologise.'
                },
                {
                    direction: 'jp_to_en',
                    prompt: 'What does this mean in English?',
                    phrase: 'おやすみなさい',
                    answer: 'good night',
                    acceptedAnswers: ['good night', 'goodnight'],
                    wordBank: ['good', 'night', 'morning', 'evening', 'sleep'],
                    hint: 'Said before going to sleep.'
                }
            ],
            'everyday words': [
                {
                    direction: 'jp_to_en',
                    prompt: 'What does this mean in English?',
                    phrase: '猫',
                    answer: 'cat',
                    acceptedAnswers: ['cat', 'a cat'],
                    wordBank: ['cat', 'dog', 'bird', 'fish', 'horse'],
                    hint: 'A common household pet.'
                },
                {
                    direction: 'en_to_jp',
                    prompt: 'Translate to Japanese:',
                    phrase: 'water',
                    answer: '水',
                    acceptedAnswers: ['水', 'みず'],
                    wordBank: ['水', '食べ物', '本', '家', '電車'],
                    hint: 'Essential for life.'
                },
                {
                    direction: 'jp_to_en',
                    prompt: 'What does this mean in English?',
                    phrase: '電車',
                    answer: 'train',
                    acceptedAnswers: ['train', 'the train'],
                    wordBank: ['train', 'bus', 'car', 'taxi', 'plane'],
                    hint: 'A common form of transport in Japan.'
                },
                {
                    direction: 'en_to_jp',
                    prompt: 'Translate to Japanese:',
                    phrase: 'book',
                    answer: '本',
                    acceptedAnswers: ['本', 'ほん'],
                    wordBank: ['本', '猫', '水', '家', '音楽'],
                    hint: 'Something you read.'
                }
            ],
            'food and ordering': [
                {
                    direction: 'jp_to_en',
                    prompt: 'What does this mean in English?',
                    phrase: '食べ物',
                    answer: 'food',
                    acceptedAnswers: ['food', 'foods'],
                    wordBank: ['food', 'drink', 'water', 'menu', 'eat'],
                    hint: 'Everything you eat.'
                },
                {
                    direction: 'en_to_jp',
                    prompt: 'Translate to Japanese:',
                    phrase: 'rice',
                    answer: 'ごはん',
                    acceptedAnswers: ['ごはん', 'ライス', '米'],
                    wordBank: ['ごはん', 'パン', '水', 'お茶', 'スープ'],
                    hint: 'A staple food in Japan.'
                },
                {
                    direction: 'jp_to_en',
                    prompt: 'Translate this phrase to English:',
                    phrase: 'メニューをください',
                    answer: 'please give me the menu',
                    acceptedAnswers: ['please give me the menu', 'can I have the menu', 'the menu please'],
                    hint: 'What you say when you sit down at a restaurant.'
                }
            ],
            'getting around': [
                {
                    direction: 'jp_to_en',
                    prompt: 'What does this mean in English?',
                    phrase: '右',
                    answer: 'right',
                    acceptedAnswers: ['right', 'turn right'],
                    wordBank: ['right', 'left', 'straight', 'back', 'up'],
                    hint: 'A direction.'
                },
                {
                    direction: 'jp_to_en',
                    prompt: 'What does this mean in English?',
                    phrase: '左',
                    answer: 'left',
                    acceptedAnswers: ['left', 'turn left'],
                    wordBank: ['left', 'right', 'straight', 'back', 'down'],
                    hint: 'The opposite of right.'
                },
                {
                    direction: 'en_to_jp',
                    prompt: 'Translate to Japanese:',
                    phrase: 'station',
                    answer: '駅',
                    acceptedAnswers: ['駅', 'えき'],
                    wordBank: ['駅', '病院', 'トイレ', 'バス', '電車'],
                    hint: 'Where trains stop.'
                }
            ]
        },

        Spanish: {
            greetings: [
                {
                    direction: 'en_to_sp',
                    prompt: 'Translate to Spanish:',
                    phrase: 'Good morning',
                    answer: 'buenos días',
                    acceptedAnswers: ['buenos días', 'buenos dias'],
                    wordBank: ['buenos', 'días', 'buenas', 'noches', 'tardes'],
                    hint: 'A morning greeting in Spanish.'
                },
                {
                    direction: 'sp_to_en',
                    prompt: 'What does this mean in English?',
                    phrase: '¿Cómo estás?',
                    answer: 'how are you',
                    acceptedAnswers: ['how are you', 'how are you?', 'how are you doing'],
                    wordBank: ['how', 'are', 'you', 'what', 'is', 'your', 'name'],
                    hint: 'A common question after greeting.'
                },
                {
                    direction: 'sp_to_en',
                    prompt: 'What does this mean in English?',
                    phrase: 'Mucho gusto',
                    answer: 'nice to meet you',
                    acceptedAnswers: ['nice to meet you', 'pleased to meet you', 'my pleasure'],
                    wordBank: ['nice', 'to', 'meet', 'you', 'hello', 'goodbye'],
                    hint: 'Said when meeting someone.'
                },
                {
                    direction: 'en_to_sp',
                    prompt: 'Translate to Spanish:',
                    phrase: 'See you later',
                    answer: 'hasta luego',
                    acceptedAnswers: ['hasta luego', 'hasta la vista', 'nos vemos'],
                    wordBank: ['hasta', 'luego', 'mañana', 'pronto', 'vista'],
                    hint: 'A casual farewell.'
                }
            ],
            'daily phrases': [
                {
                    direction: 'sp_to_en',
                    prompt: 'What does this mean in English?',
                    phrase: 'No entiendo',
                    answer: 'I do not understand',
                    acceptedAnswers: ["i don't understand", 'i do not understand', 'i dont understand'],
                    wordBank: ['I', 'do', 'not', 'understand', 'speak', 'know'],
                    hint: 'Said when something is unclear.'
                },
                {
                    direction: 'en_to_sp',
                    prompt: 'Translate to Spanish:',
                    phrase: 'I need help',
                    answer: 'necesito ayuda',
                    acceptedAnswers: ['necesito ayuda', 'necesito una ayuda'],
                    wordBank: ['necesito', 'ayuda', 'quiero', 'tengo', 'busco'],
                    hint: 'A phrase for when you are in trouble.'
                },
                {
                    direction: 'sp_to_en',
                    prompt: 'What does this mean in English?',
                    phrase: '¿Dónde está el baño?',
                    answer: 'where is the bathroom',
                    acceptedAnswers: ['where is the bathroom', 'where is the toilet', 'where is the restroom'],
                    wordBank: ['where', 'is', 'the', 'bathroom', 'toilet', 'exit', 'hotel'],
                    hint: 'A very useful question when travelling.'
                }
            ],
            'food and ordering': [
                {
                    direction: 'sp_to_en',
                    prompt: 'What does this mean in English?',
                    phrase: 'La cuenta, por favor',
                    answer: 'the bill please',
                    acceptedAnswers: ['the bill please', 'the check please', 'can i have the bill'],
                    wordBank: ['the', 'bill', 'please', 'check', 'menu', 'more'],
                    hint: 'What you say at the end of a meal.'
                },
                {
                    direction: 'en_to_sp',
                    prompt: 'Translate to Spanish:',
                    phrase: 'I would like water',
                    answer: 'quisiera agua',
                    acceptedAnswers: ['quisiera agua', 'quiero agua', 'me gustaría agua'],
                    wordBank: ['quisiera', 'agua', 'quiero', 'una', 'cerveza', 'leche'],
                    hint: 'Ordering a drink politely.'
                },
                {
                    direction: 'sp_to_en',
                    prompt: 'What does this mean in English?',
                    phrase: '¿Qué recomienda?',
                    answer: 'what do you recommend',
                    acceptedAnswers: ['what do you recommend', 'what would you recommend', 'what is good'],
                    wordBank: ['what', 'do', 'you', 'recommend', 'have', 'want'],
                    hint: 'Asking for a suggestion.'
                }
            ],
            'getting around': [
                {
                    direction: 'sp_to_en',
                    prompt: 'What does this mean in English?',
                    phrase: '¿Dónde está la estación?',
                    answer: 'where is the station',
                    acceptedAnswers: ['where is the station', 'where is the train station'],
                    wordBank: ['where', 'is', 'the', 'station', 'airport', 'hotel', 'bus'],
                    hint: 'Asking for directions.'
                },
                {
                    direction: 'en_to_sp',
                    prompt: 'Translate to Spanish:',
                    phrase: 'Turn left',
                    answer: 'gire a la izquierda',
                    acceptedAnswers: ['gire a la izquierda', 'dobla a la izquierda', 'a la izquierda'],
                    wordBank: ['gire', 'a', 'la', 'izquierda', 'derecha', 'recto'],
                    hint: 'A direction instruction.'
                }
            ]
        },

        French: {
            'basic words': [
                {
                    direction: 'fr_to_en',
                    prompt: 'What does this mean in English?',
                    phrase: 'Bonjour',
                    answer: 'hello',
                    acceptedAnswers: ['hello', 'good day', 'good morning'],
                    wordBank: ['hello', 'goodbye', 'thank you', 'please', 'sorry'],
                    hint: 'The standard French greeting.'
                },
                {
                    direction: 'en_to_fr',
                    prompt: 'Translate to French:',
                    phrase: 'thank you',
                    answer: 'merci',
                    acceptedAnswers: ['merci', 'merci beaucoup'],
                    wordBank: ['merci', 'bonjour', 'au revoir', "s'il vous plaît", 'pardon'],
                    hint: 'Expressing gratitude in French.'
                },
                {
                    direction: 'fr_to_en',
                    prompt: 'What does this mean in English?',
                    phrase: "S'il vous plaît",
                    answer: 'please',
                    acceptedAnswers: ['please', 'if you please'],
                    wordBank: ['please', 'thank you', 'sorry', 'excuse me', 'help'],
                    hint: 'The polite way to make a request.'
                }
            ],
            'at the café': [
                {
                    direction: 'fr_to_en',
                    prompt: 'What does this mean in English?',
                    phrase: 'Un café, s\'il vous plaît',
                    answer: 'a coffee please',
                    acceptedAnswers: ['a coffee please', 'one coffee please', 'coffee please'],
                    wordBank: ['a', 'coffee', 'please', 'tea', 'water', 'juice'],
                    hint: 'Ordering at a café.'
                },
                {
                    direction: 'en_to_fr',
                    prompt: 'Translate to French:',
                    phrase: 'The bill please',
                    answer: "l'addition s'il vous plaît",
                    acceptedAnswers: ["l'addition s'il vous plaît", "l'addition", 'addition'],
                    hint: 'Asking for the bill.'
                },
                {
                    direction: 'fr_to_en',
                    prompt: 'What does this mean in English?',
                    phrase: 'Avez-vous une table?',
                    answer: 'do you have a table',
                    acceptedAnswers: ['do you have a table', 'is there a table', 'have you a table'],
                    wordBank: ['do', 'you', 'have', 'a', 'table', 'seat', 'room'],
                    hint: 'Asking to be seated.'
                }
            ],
            'food and ordering': [
                {
                    direction: 'en_to_fr',
                    prompt: 'Translate to French:',
                    phrase: 'I would like bread',
                    answer: 'je voudrais du pain',
                    acceptedAnswers: ['je voudrais du pain', 'je veux du pain'],
                    wordBank: ['je', 'voudrais', 'du', 'pain', 'lait', 'fromage', 'eau'],
                    hint: 'Politely ordering bread.'
                },
                {
                    direction: 'fr_to_en',
                    prompt: 'What does this mean in English?',
                    phrase: 'Je suis végétarien',
                    answer: 'I am vegetarian',
                    acceptedAnswers: ['i am vegetarian', 'i am a vegetarian'],
                    wordBank: ['I', 'am', 'a', 'vegetarian', 'vegan', 'allergic'],
                    hint: 'Telling the waiter about your diet.'
                }
            ]
        },

        German: {
            'travel basics': [
                {
                    direction: 'en_to_de',
                    prompt: 'Translate to German:',
                    phrase: 'Where is the train station?',
                    answer: 'Wo ist der Bahnhof?',
                    acceptedAnswers: ['wo ist der bahnhof', 'wo ist der bahnhof?'],
                    wordBank: ['Wo', 'ist', 'der', 'Bahnhof', 'Flughafen', 'Busbahnhof'],
                    hint: 'Asking for the train station.'
                },
                {
                    direction: 'de_to_en',
                    prompt: 'What does this mean in English?',
                    phrase: 'Wie viel kostet das?',
                    answer: 'how much does it cost',
                    acceptedAnswers: ['how much does it cost', 'how much is it', 'what does it cost'],
                    wordBank: ['how', 'much', 'does', 'it', 'cost', 'price', 'is'],
                    hint: 'Asking about the price.'
                },
                {
                    direction: 'de_to_en',
                    prompt: 'What does this mean in English?',
                    phrase: 'Ich verstehe nicht',
                    answer: 'I do not understand',
                    acceptedAnswers: ["i don't understand", 'i do not understand', 'i dont understand'],
                    wordBank: ['I', 'do', 'not', 'understand', 'speak', 'know'],
                    hint: 'Saying you do not understand.'
                }
            ],
            food: [
                {
                    direction: 'de_to_en',
                    prompt: 'What does this mean in English?',
                    phrase: 'Die Speisekarte, bitte',
                    answer: 'the menu please',
                    acceptedAnswers: ['the menu please', 'the menu, please', 'menu please'],
                    wordBank: ['the', 'menu', 'please', 'bill', 'water', 'more'],
                    hint: 'Asking for the menu.'
                },
                {
                    direction: 'en_to_de',
                    prompt: 'Translate to German:',
                    phrase: 'I am hungry',
                    answer: 'Ich habe Hunger',
                    acceptedAnswers: ['ich habe hunger', 'ich bin hungrig'],
                    wordBank: ['Ich', 'habe', 'Hunger', 'bin', 'hungrig', 'durst'],
                    hint: 'Expressing hunger in German.'
                }
            ]
        },

        Italian: {
            'food and travel': [
                {
                    direction: 'it_to_en',
                    prompt: 'What does this mean in English?',
                    phrase: 'Un tavolo per due, per favore',
                    answer: 'a table for two please',
                    acceptedAnswers: ['a table for two please', 'table for two please'],
                    wordBank: ['a', 'table', 'for', 'two', 'please', 'one', 'four'],
                    hint: 'Requesting a table at a restaurant.'
                },
                {
                    direction: 'en_to_it',
                    prompt: 'Translate to Italian:',
                    phrase: 'thank you very much',
                    answer: 'grazie mille',
                    acceptedAnswers: ['grazie mille', 'molte grazie', 'tante grazie'],
                    wordBank: ['grazie', 'mille', 'molto', 'prego', 'ciao'],
                    hint: 'A warm expression of gratitude.'
                }
            ],
            'travel basics': [
                {
                    direction: 'it_to_en',
                    prompt: 'What does this mean in English?',
                    phrase: 'Dov\'è la stazione?',
                    answer: 'where is the station',
                    acceptedAnswers: ['where is the station', 'where is the train station'],
                    wordBank: ['where', 'is', 'the', 'station', 'airport', 'hotel'],
                    hint: 'Asking for directions to the station.'
                },
                {
                    direction: 'en_to_it',
                    prompt: 'Translate to Italian:',
                    phrase: 'How much does it cost?',
                    answer: 'Quanto costa?',
                    acceptedAnswers: ['quanto costa', 'quanto costa?', 'quanto viene'],
                    wordBank: ['Quanto', 'costa', 'viene', 'è', 'prezzo'],
                    hint: 'Asking for the price.'
                }
            ]
        },

        Arabic: {
            'starter words': [
                {
                    direction: 'ar_to_en',
                    prompt: 'What does this mean in English?',
                    phrase: 'مرحبا',
                    answer: 'hello',
                    acceptedAnswers: ['hello', 'hi', 'greetings'],
                    wordBank: ['hello', 'goodbye', 'thank you', 'please', 'yes'],
                    hint: 'The common Arabic greeting.'
                },
                {
                    direction: 'en_to_ar',
                    prompt: 'Translate to Arabic:',
                    phrase: 'thank you',
                    answer: 'شكرا',
                    acceptedAnswers: ['شكرا', 'شكرًا', 'شكراً'],
                    wordBank: ['شكرا', 'مرحبا', 'وداعا', 'نعم', 'لا'],
                    hint: 'Expressing gratitude in Arabic.'
                },
                {
                    direction: 'ar_to_en',
                    prompt: 'What does this mean in English?',
                    phrase: 'من فضلك',
                    answer: 'please',
                    acceptedAnswers: ['please', 'if you please'],
                    wordBank: ['please', 'thank you', 'sorry', 'excuse me', 'help'],
                    hint: 'A polite request word in Arabic.'
                }
            ],
            'helpful phrases': [
                {
                    direction: 'ar_to_en',
                    prompt: 'What does this mean in English?',
                    phrase: 'لا أفهم',
                    answer: 'I do not understand',
                    acceptedAnswers: ["i don't understand", 'i do not understand', 'i dont understand'],
                    wordBank: ['I', 'do', 'not', 'understand', 'speak', 'know'],
                    hint: 'Saying you do not understand.'
                },
                {
                    direction: 'en_to_ar',
                    prompt: 'Translate to Arabic:',
                    phrase: 'Where is the bathroom?',
                    answer: 'أين الحمام؟',
                    acceptedAnswers: ['أين الحمام', 'أين الحمام؟'],
                    hint: 'A very useful travel phrase.'
                }
            ]
        },

        Hindi: {
            'devangiri basics': [
                {
                    direction: 'hi_to_en',
                    prompt: 'What does this mean in English?',
                    phrase: 'नमस्ते',
                    answer: 'hello',
                    acceptedAnswers: ['hello', 'hi', 'namaste'],
                    wordBank: ['hello', 'goodbye', 'thank you', 'please', 'yes'],
                    hint: 'The common Hindi greeting.'
                },
                {
                    direction: 'en_to_hi',
                    prompt: 'Translate to Hindi:',
                    phrase: 'thank you',
                    answer: 'धन्यवाद',
                    acceptedAnswers: ['धन्यवाद', 'शुक्रिया'],
                    wordBank: ['धन्यवाद', 'नमस्ते', 'अलविदा', 'हाँ', 'नहीं'],
                    hint: 'Expressing gratitude in Hindi.'
                }
            ],
            'everyday words': [
                {
                    direction: 'hi_to_en',
                    prompt: 'What does this mean in English?',
                    phrase: 'पानी',
                    answer: 'water',
                    acceptedAnswers: ['water', 'the water'],
                    wordBank: ['water', 'food', 'tea', 'milk', 'juice'],
                    hint: 'Essential for life.'
                },
                {
                    direction: 'en_to_hi',
                    prompt: 'Translate to Hindi:',
                    phrase: 'book',
                    answer: 'किताब',
                    acceptedAnswers: ['किताब', 'पुस्तक'],
                    wordBank: ['किताब', 'पानी', 'घर', 'दरवाज़ा', 'सूरज'],
                    hint: 'Something you read.'
                },
                {
                    direction: 'hi_to_en',
                    prompt: 'What does this mean in English?',
                    phrase: 'कल',
                    answer: 'tomorrow',
                    acceptedAnswers: ['tomorrow', 'yesterday'],
                    wordBank: ['tomorrow', 'today', 'yesterday', 'tonight', 'morning'],
                    hint: 'In Hindi, this word can mean tomorrow or yesterday depending on context.'
                }
            ],
            'helpful phrases': [
                {
                    direction: 'hi_to_en',
                    prompt: 'What does this mean in English?',
                    phrase: 'मुझे मदद चाहिए',
                    answer: 'I need help',
                    acceptedAnswers: ['i need help', 'i want help', 'help me'],
                    wordBank: ['I', 'need', 'help', 'want', 'please', 'thank you'],
                    hint: 'Asking for assistance.'
                },
                {
                    direction: 'en_to_hi',
                    prompt: 'Translate to Hindi:',
                    phrase: 'How are you?',
                    answer: 'आप कैसे हैं?',
                    acceptedAnswers: ['आप कैसे हैं', 'आप कैसे हैं?', 'तुम कैसे हो'],
                    wordBank: ['आप', 'कैसे', 'हैं', 'तुम', 'हो', 'मैं'],
                    hint: 'The polite form of asking how someone is.'
                }
            ]
        },

        Korean: {
            'hangul basics': [
                {
                    direction: 'ko_to_en',
                    prompt: 'What does this mean in English?',
                    phrase: '안녕하세요',
                    answer: 'hello',
                    acceptedAnswers: ['hello', 'hi', 'good day'],
                    wordBank: ['hello', 'goodbye', 'thank you', 'please', 'yes'],
                    hint: 'The polite Korean greeting.'
                },
                {
                    direction: 'en_to_ko',
                    prompt: 'Translate to Korean:',
                    phrase: 'thank you',
                    answer: '감사합니다',
                    acceptedAnswers: ['감사합니다', '고맙습니다', '고마워요'],
                    wordBank: ['감사합니다', '안녕하세요', '안녕히 가세요', '네', '아니요'],
                    hint: 'The polite way to say thank you.'
                }
            ],
            greetings: [
                {
                    direction: 'ko_to_en',
                    prompt: 'What does this mean in English?',
                    phrase: '만나서 반갑습니다',
                    answer: 'nice to meet you',
                    acceptedAnswers: ['nice to meet you', 'pleased to meet you'],
                    wordBank: ['nice', 'to', 'meet', 'you', 'hello', 'goodbye'],
                    hint: 'Said when meeting someone for the first time.'
                },
                {
                    direction: 'en_to_ko',
                    prompt: 'Translate to Korean:',
                    phrase: 'goodbye (to someone leaving)',
                    answer: '안녕히 가세요',
                    acceptedAnswers: ['안녕히 가세요', '안녕'],
                    wordBank: ['안녕히', '가세요', '계세요', '안녕', '잘'],
                    hint: 'Said to someone who is leaving.'
                }
            ],
            'everyday words': [
                {
                    direction: 'ko_to_en',
                    prompt: 'What does this mean in English?',
                    phrase: '물',
                    answer: 'water',
                    acceptedAnswers: ['water', 'the water'],
                    wordBank: ['water', 'food', 'tea', 'milk', 'juice'],
                    hint: 'Essential for life.'
                },
                {
                    direction: 'en_to_ko',
                    prompt: 'Translate to Korean:',
                    phrase: 'family',
                    answer: '가족',
                    acceptedAnswers: ['가족'],
                    wordBank: ['가족', '친구', '학교', '집', '물'],
                    hint: 'The people you live with.'
                }
            ]
        },

        Telugu: {
            'telugu script basics': [
                {
                    direction: 'te_to_en',
                    prompt: 'What does this mean in English?',
                    phrase: 'నమస్కారం',
                    answer: 'hello',
                    acceptedAnswers: ['hello', 'hi', 'namaskaram'],
                    wordBank: ['hello', 'goodbye', 'thank you', 'please', 'yes'],
                    hint: 'The common Telugu greeting.'
                },
                {
                    direction: 'en_to_te',
                    prompt: 'Translate to Telugu:',
                    phrase: 'thank you',
                    answer: 'ధన్యవాదాలు',
                    acceptedAnswers: ['ధన్యవాదాలు', 'చాలా ధన్యవాదాలు'],
                    wordBank: ['ధన్యవాదాలు', 'నమస్కారం', 'సరే', 'అవును', 'కాదు'],
                    hint: 'Expressing gratitude in Telugu.'
                }
            ],
            greetings: [
                {
                    direction: 'te_to_en',
                    prompt: 'What does this mean in English?',
                    phrase: 'మీరు ఎలా ఉన్నారు?',
                    answer: 'how are you',
                    acceptedAnswers: ['how are you', 'how are you?'],
                    wordBank: ['how', 'are', 'you', 'what', 'is', 'your', 'name'],
                    hint: 'Asking about someone\'s well-being.'
                },
                {
                    direction: 'en_to_te',
                    prompt: 'Translate to Telugu:',
                    phrase: 'good morning',
                    answer: 'శుభోదయం',
                    acceptedAnswers: ['శుభోదయం'],
                    wordBank: ['శుభోదయం', 'శుభరాత్రి', 'నమస్కారం', 'హలో', 'సరే'],
                    hint: 'A morning greeting in Telugu.'
                }
            ],
            'everyday words': [
                {
                    direction: 'te_to_en',
                    prompt: 'What does this mean in English?',
                    phrase: 'నీళ్ళు',
                    answer: 'water',
                    acceptedAnswers: ['water', 'the water'],
                    wordBank: ['water', 'food', 'tea', 'milk', 'juice'],
                    hint: 'Essential for life.'
                },
                {
                    direction: 'te_to_en',
                    prompt: 'What does this mean in English?',
                    phrase: 'ఇల్లు',
                    answer: 'house',
                    acceptedAnswers: ['house', 'home', 'a house'],
                    wordBank: ['house', 'school', 'street', 'city', 'door'],
                    hint: 'Where you live.'
                }
            ]
        }
    };

    // ═══════════════════════════════════════════════════════════════════
    //  CHESS & MUSIC SAMPLES
    // ═══════════════════════════════════════════════════════════════════

    const CHESS_SAMPLES = {
        'piece movement': [
            { fen: '7k/8/8/8/4K3/8/8/8 w - - 0 1', from: 'e4', answer: 'e5', legalMoves: ['d3', 'd4', 'd5', 'e3', 'e5', 'f3', 'f4', 'f5'], prompt: 'The king is highlighted. Tap a square where it can move.', hint: 'The king moves one square in any direction.' },
            { fen: 'k7/8/8/8/3Q4/8/8/7K w - - 0 1', from: 'd4', answer: 'd5', legalMoves: ['a1', 'a4', 'a7', 'b2', 'b4', 'b6', 'c3', 'c4', 'c5', 'd1', 'd2', 'd3', 'd5', 'd6', 'd7', 'd8', 'e3', 'e4', 'e5', 'f2', 'f4', 'f6', 'g1', 'g4', 'g7', 'h4', 'h8'], prompt: 'The queen is highlighted. Tap a square where it can move.', hint: 'The queen moves in straight and diagonal lines.' },
            { fen: '7k/8/8/8/8/8/8/K2R4 w - - 0 1', from: 'd1', answer: 'd2', legalMoves: ['b1', 'c1', 'e1', 'f1', 'g1', 'h1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7', 'd8'], prompt: 'The rook is highlighted. Tap a square where it can move.', hint: 'The rook moves along ranks and files.' },
            { fen: '7k/8/8/8/2B5/8/8/K7 w - - 0 1', from: 'c4', answer: 'd5', legalMoves: ['a2', 'a6', 'b3', 'b5', 'd3', 'd5', 'e2', 'e6', 'f1', 'f7', 'g8'], prompt: 'The bishop is highlighted. Tap a square where it can move.', hint: 'The bishop moves along diagonals.' },
            { fen: '7k/8/8/8/8/8/8/K5N1 w - - 0 1', from: 'g1', answer: 'f3', legalMoves: ['e2', 'f3', 'h3'], prompt: 'The knight is highlighted. Tap a square where it can move.', hint: 'A knight moves in an L-shape.' },
            { fen: '7k/8/8/8/8/8/4P3/K7 w - - 0 1', from: 'e2', answer: 'e3', legalMoves: ['e3', 'e4'], prompt: 'The pawn is highlighted. Tap a square where it can move.', hint: 'Pawns move forward and can move two squares on their first move.' }
        ],
        'capturing and attacking': [
            { type: 'capture', fen: '7k/3p4/8/8/3R4/8/8/K7 w - - 0 1', from: 'd4', answer: 'd7', legalMoves: ['d1', 'd2', 'd3', 'd5', 'd6', 'd7', 'a4', 'b4', 'c4', 'e4', 'f4', 'g4', 'h4'], captureSquares: ['d7'], prompt: 'Capture a star with the highlighted rook.', hint: 'The rook moves along ranks and files to capture.' },
            { type: 'capture', fen: '7k/8/4p3/8/3N4/8/8/K7 w - - 0 1', from: 'd4', answer: 'e6', legalMoves: ['b3', 'b5', 'c2', 'c6', 'e2', 'e6', 'f3', 'f5'], captureSquares: ['e6'], prompt: 'Capture a star with the highlighted knight.', hint: 'Knights capture in an L-shape.' },
            { type: 'capture', fen: '7k/5p2/8/8/2B5/8/8/K7 w - - 0 1', from: 'c4', answer: 'f7', legalMoves: ['a2', 'a6', 'b3', 'b5', 'd3', 'd5', 'e2', 'e6', 'f1', 'f7'], captureSquares: ['f7'], prompt: 'Capture a star with the highlighted bishop.', hint: 'The bishop captures along a diagonal.' }
        ],
        checkmate: [
            { fen: 'Q7/5K1k/8/5p2/8/8/8/8 w - - 0 1', from: 'a8', answer: 'h1', prompt: 'The queen is highlighted. Tap the square that delivers checkmate.', hint: 'Checkmate means the king is in check with no escape.' },
            { fen: '1n6/8/8/k1K5/8/5Q2/8/8 w - - 0 1', from: 'f3', answer: 'a3', prompt: 'The queen is highlighted. Tap the square that delivers checkmate.', hint: 'Queens can dominate the back rank.' },
            { fen: '4n3/8/8/8/4R3/1K6/8/k7 w - - 0 1', from: 'e4', answer: 'e1', prompt: 'The rook is highlighted. Tap the square that delivers checkmate.', hint: 'Rooks can mate along the back rank.' }
        ],
        opening: [
            { fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w - - 0 1', from: 'e2', answer: 'e4', prompt: 'The pawn is highlighted. Tap the opening move.', hint: "King's pawn opening." },
            { fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w - - 0 1', from: 'd2', answer: 'd4', prompt: 'The pawn is highlighted. Tap the opening move.', hint: "Queen's pawn opening." },
            { fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w - - 0 1', from: 'g1', answer: 'f3', prompt: 'The knight is highlighted. Tap the developing move.', hint: 'Knights develop before bishops.' }
        ],
        endgame: [
            { fen: '7k/8/8/8/8/8/4P3/4K3 w - - 0 1', from: 'e2', answer: 'e4', prompt: 'The pawn is highlighted. Push it toward the promotion square.', hint: 'Push the pawn and escort it with the king.' },
            { fen: '7k/8/8/8/8/8/8/3QK3 w - - 0 1', from: 'd1', answer: 'd8', prompt: 'The queen is highlighted. Tap the square that delivers checkmate.', hint: 'Look for a queen move that traps the king.' },
            { fen: '7k/8/8/8/8/8/3R4/7K w - - 0 1', from: 'd2', answer: 'd8', prompt: 'The rook is highlighted. Tap the square that delivers checkmate.', hint: 'Rooks can mate along the back rank.' }
        ],

        fork: [
            { fen: '7k/8/8/8/8/5N2/8/6K1 w - - 0 1', from: 'f3', answer: 'g5', legalMoves: ['d2', 'd4', 'e1', 'e5', 'g1', 'g5', 'h2', 'h4'], prompt: 'The knight is highlighted. Find the fork that attacks king and rook.', hint: 'A fork attacks two pieces at once.' },
            { fen: '6k1/8/8/8/8/8/5N2/r5K1 w - - 0 1', from: 'f2', answer: 'e4', legalMoves: ['d1', 'd3', 'e4', 'g4', 'h1', 'h3'], prompt: 'The knight is highlighted. Fork the king and rook.', hint: 'Move the knight to attack both pieces simultaneously.' },
            { fen: '6k1/8/8/3p4/8/4N3/8/6K1 w - - 0 1', from: 'e3', answer: 'f5', legalMoves: ['c2', 'c4', 'd1', 'd5', 'f1', 'f5', 'g2', 'g4'], prompt: 'The knight is highlighted. Fork king and pawn.', hint: 'Knights are the best forking pieces.' },
            { fen: '8/6k1/8/8/8/8/5N2/r5K1 w - - 0 1', from: 'f2', answer: 'd3', legalMoves: ['d1', 'd3', 'e4', 'g4', 'h1', 'h3'], prompt: 'The knight is highlighted. Find the best fork.', hint: 'Attack two targets with one move.' },
            { fen: '8/8/6k1/8/4N3/8/8/r5K1 w - - 0 1', from: 'e4', answer: 'f6', legalMoves: ['c3', 'c5', 'd2', 'd6', 'f2', 'f6', 'g3', 'g5'], prompt: 'The knight is highlighted. Fork king and rook.', hint: 'Look for a square that attacks both pieces.' },
            { fen: '8/8/8/3k4/8/2N5/8/6K1 w - - 0 1', from: 'c3', answer: 'e4', legalMoves: ['a2', 'a4', 'b1', 'b5', 'd1', 'd5', 'e2', 'e4'], prompt: 'The knight is highlighted. Find the royal fork.', hint: 'A royal fork attacks king and queen.' }
        ],

        pin: [
            { fen: '6k1/8/8/1b6/8/8/8/R3K3 w - - 0 1', from: 'a1', answer: 'a5', legalMoves: ['a2', 'a3', 'a4', 'a5', 'b1', 'c1', 'd1'], prompt: 'The rook is highlighted. Pin the bishop to the king.', hint: 'A pin stops a piece from moving without exposing the king.' },
            { fen: '6k1/8/8/8/8/5n2/8/4RK2 w - - 0 1', from: 'e1', answer: 'e3', legalMoves: ['e2', 'e3', 'e4', 'e5', 'e6', 'e7', 'e8'], prompt: 'The rook is highlighted. Pin the knight to the king.', hint: 'The pinned piece is between the rook and the king.' },
            { fen: '6k1/3r4/8/8/8/8/3B4/3K4 w - - 0 1', from: 'd2', answer: 'd7', legalMoves: ['a5', 'b4', 'c1', 'c3', 'e1', 'e3', 'f4', 'g5', 'h6', 'b4', 'e3', 'f4', 'g5', 'h6', 'c3', 'e1', 'd7'], prompt: 'The bishop is highlighted. Pin the rook to the king.', hint: 'Bishops pin along diagonals.' },
            { fen: '6k1/8/8/8/3n4/8/8/3RK3 w - - 0 1', from: 'd1', answer: 'd4', legalMoves: ['a1', 'b1', 'c1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7', 'd8', 'e1'], prompt: 'The rook is highlighted. Pin the knight.', hint: 'The knight cannot move without exposing the king.' },
            { fen: '7k/8/8/5b2/8/8/8/4RK2 w - - 0 1', from: 'e1', answer: 'e5', legalMoves: ['e2', 'e3', 'e4', 'e5', 'e6', 'e7', 'e8'], prompt: 'The rook is highlighted. Pin the bishop.', hint: 'Look for the piece between the rook line and the king.' },
            { fen: '6k1/8/4n3/8/8/8/8/4RK2 w - - 0 1', from: 'e1', answer: 'e6', legalMoves: ['e2', 'e3', 'e4', 'e5', 'e6', 'e7', 'e8'], prompt: 'The rook is highlighted. Pin the knight to the king.', hint: 'A pinned piece is paralysed.' }
        ],

        sacrifice: [
            { fen: '6k1/5ppp/8/8/8/8/8/3QK3 w - - 0 1', from: 'd1', answer: 'h5', legalMoves: ['a1', 'a4', 'b3', 'c1', 'c2', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7', 'd8', 'e2', 'f3', 'g4', 'h5'], prompt: 'The queen is highlighted. Sacrifice to open the king.', hint: 'Sometimes giving up material wins the game.' },
            { fen: '5rk1/5ppp/8/8/8/8/8/3RK3 w - - 0 1', from: 'd1', answer: 'd8', legalMoves: ['a1', 'b1', 'c1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7', 'd8'], prompt: 'The rook is highlighted. Sacrifice on the back rank.', hint: 'A rook sacrifice can open lines for a decisive attack.' },
            { fen: '6k1/6pp/8/8/4B3/8/8/4K3 w - - 0 1', from: 'e4', answer: 'h7', legalMoves: ['a8', 'b1', 'b7', 'c2', 'c6', 'd3', 'd5', 'f3', 'f5', 'g2', 'g6', 'h7'], prompt: 'The bishop is highlighted. Sacrifice on h7 to expose the king.', hint: 'The classic bishop sacrifice on h7.' },
            { fen: '6k1/5ppp/8/3N4/8/8/8/4K3 w - - 0 1', from: 'd5', answer: 'f6', legalMoves: ['b4', 'b6', 'c3', 'c7', 'e3', 'e7', 'f4', 'f6'], prompt: 'The knight is highlighted. Sacrifice to destroy the pawn cover.', hint: 'Destroying pawn cover exposes the king.' },
            { fen: '6k1/6pp/5p2/8/4B3/8/8/4K3 w - - 0 1', from: 'e4', answer: 'f5', legalMoves: ['a8', 'b1', 'b7', 'c2', 'c6', 'd3', 'd5', 'f3', 'f5', 'g2', 'g6', 'h7'], prompt: 'The bishop is highlighted. Find the best sacrifice.', hint: 'Give up the piece for a decisive attack.' },
            { fen: '5k2/5ppp/8/8/8/8/8/3QK3 w - - 0 1', from: 'd1', answer: 'd8', legalMoves: ['a1', 'a4', 'b3', 'c1', 'c2', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7', 'd8', 'e2', 'f3', 'g4', 'h5'], prompt: 'The queen is highlighted. Find the winning sacrifice.', hint: 'Sometimes the most powerful move is giving up the queen.' }
        ],

        skewer: [
            { fen: '7k/8/8/8/8/8/8/R3K3 w - - 0 1', from: 'a1', answer: 'h1', legalMoves: ['a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8', 'b1', 'c1', 'd1', 'e1', 'f1', 'g1', 'h1'], prompt: 'The rook is highlighted. Skewer the king.', hint: 'A skewer attacks a valuable piece forcing it to move.' },
            { fen: '7k/8/8/8/8/8/8/4KB2 w - - 0 1', from: 'f1', answer: 'c4', legalMoves: ['a6', 'b5', 'c4', 'd3', 'e2', 'g2', 'h3'], prompt: 'The bishop is highlighted. Find the skewer.', hint: 'The king must move, losing the piece behind it.' },
            { fen: 'r6k/8/8/8/8/8/8/4KR2 w - - 0 1', from: 'f1', answer: 'f8', legalMoves: ['a1', 'b1', 'c1', 'd1', 'e1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8'], prompt: 'The rook is highlighted. Skewer the king to win the rook.', hint: 'Force the king to move and capture what is behind it.' },
            { fen: '7k/8/8/5r2/8/8/8/4KB2 w - - 0 1', from: 'f1', answer: 'b5', legalMoves: ['a6', 'b5', 'c4', 'd3', 'e2', 'g2', 'h3'], prompt: 'The bishop is highlighted. Skewer the rook.', hint: 'Attack the king forcing it to expose the rook.' },
            { fen: 'r6k/8/8/8/8/8/8/R3K3 w - - 0 1', from: 'a1', answer: 'a8', legalMoves: ['a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8', 'b1', 'c1', 'd1'], prompt: 'The rook is highlighted. Find the skewer.', hint: 'Push through the king to win the rook behind it.' },
            { fen: '7k/8/8/8/8/5r2/8/4KB2 w - - 0 1', from: 'f1', answer: 'c4', legalMoves: ['a6', 'b5', 'c4', 'd3', 'e2', 'g2', 'h3'], prompt: 'The bishop is highlighted. Skewer the king to win the rook.', hint: 'A skewer is like a pin in reverse.' }
        ],

        'discovered attack': [
            { fen: '6k1/8/8/3b4/8/8/3B4/3RK3 w - - 0 1', from: 'd2', answer: 'e3', legalMoves: ['a5', 'b4', 'c1', 'c3', 'e1', 'e3', 'f4', 'g5', 'h6'], prompt: 'The bishop is highlighted. Move it to unleash a discovered attack.', hint: 'Moving the bishop reveals a rook attack.' },
            { fen: '7k/8/8/8/3B4/8/8/3RK3 w - - 0 1', from: 'd4', answer: 'g7', legalMoves: ['a1', 'a7', 'b2', 'b6', 'c3', 'c5', 'e3', 'e5', 'f2', 'f6', 'g1', 'g7', 'h8'], prompt: 'The bishop is highlighted. Discover an attack with a check.', hint: 'Move to give check and reveal the rook.' },
            { fen: '7k/8/4r3/8/8/4N3/8/4RK2 w - - 0 1', from: 'e3', answer: 'f5', legalMoves: ['c2', 'c4', 'd1', 'd5', 'f1', 'f5', 'g2', 'g4'], prompt: 'The knight is highlighted. Move to unleash a discovered rook attack.', hint: 'The rook behind the knight becomes active after the knight moves.' },
            { fen: '6k1/8/8/8/3N4/8/8/3BK3 w - - 0 1', from: 'd4', answer: 'f5', legalMoves: ['b3', 'b5', 'c2', 'c6', 'e2', 'e6', 'f3', 'f5'], prompt: 'The knight is highlighted. Move to reveal the bishop attack.', hint: 'A discovered attack can win material even without a check.' },
            { fen: '7k/8/8/8/8/5N2/8/3BK3 w - - 0 1', from: 'f3', answer: 'g5', legalMoves: ['d2', 'd4', 'e1', 'e5', 'g1', 'g5', 'h2', 'h4'], prompt: 'The knight is highlighted. Find the discovered attack.', hint: 'Move the knight to reveal the bishop and attack the king.' },
            { fen: '6k1/3r4/8/8/3N4/8/8/3RK3 w - - 0 1', from: 'd4', answer: 'e6', legalMoves: ['b3', 'b5', 'c2', 'c6', 'e2', 'e6', 'f3', 'f5'], prompt: 'The knight is highlighted. Discover the rook attack on the rook.', hint: 'The knight move opens the rook line.' }
        ],

        battery: [
            { fen: '7k/8/8/8/8/8/3RR3/3K4 w - - 0 1', from: 'd2', answer: 'd8', legalMoves: ['a2', 'b2', 'c2', 'd1', 'd3', 'd4', 'd5', 'd6', 'd7', 'd8'], prompt: 'The rook is highlighted. Use the battery to deliver checkmate.', hint: 'Two rooks on the same file form a battery.' },
            { fen: '7k/8/8/8/8/3Q4/3R4/3K4 w - - 0 1', from: 'd3', answer: 'd8', legalMoves: ['a3', 'b3', 'c3', 'c4', 'd4', 'd5', 'd6', 'd7', 'd8', 'e3', 'e4', 'f5', 'g6', 'h7'], prompt: 'The queen is highlighted. Fire the queen-rook battery.', hint: 'The queen and rook are aligned on the d-file.' },
            { fen: '7k/8/8/8/2B5/3Q4/8/3K4 w - - 0 1', from: 'd3', answer: 'h7', legalMoves: ['a3', 'b3', 'c3', 'c4', 'd4', 'd5', 'd6', 'd7', 'd8', 'e3', 'e4', 'f5', 'g6', 'h7'], prompt: 'The queen is highlighted. Find the battery checkmate.', hint: 'The queen and bishop form a diagonal battery.' },
            { fen: '7k/8/8/8/8/8/3QR3/3K4 w - - 0 1', from: 'd2', answer: 'd8', legalMoves: ['a2', 'b2', 'c2', 'd1', 'd3', 'd4', 'd5', 'd6', 'd7', 'd8', 'e2'], prompt: 'The queen is highlighted. Use the battery to checkmate.', hint: 'Queen and rook batteries are devastating.' },
            { fen: '7k/8/8/3Q4/3R4/8/8/3K4 w - - 0 1', from: 'd5', answer: 'd8', legalMoves: ['a2', 'a5', 'a8', 'b3', 'b5', 'b7', 'c4', 'c5', 'c6', 'd1', 'd2', 'd3', 'd4', 'd6', 'd7', 'd8', 'e4', 'e5', 'e6', 'f3', 'f5', 'f7', 'g2', 'g5', 'h1', 'h5'], prompt: 'The queen is highlighted. Deliver checkmate using the battery.', hint: 'March the queen forward on the file.' }
        ],

        deflection: [
            { fen: '6k1/6Q1/8/8/8/8/8/4K3 w - - 0 1', from: 'g7', answer: 'g6', legalMoves: ['a1', 'a7', 'b2', 'b7', 'c3', 'c7', 'd4', 'd7', 'e5', 'e7', 'f6', 'f7', 'f8', 'g1', 'g2', 'g3', 'g4', 'g5', 'g6', 'g8', 'h6', 'h7', 'h8'], prompt: 'The queen is highlighted. Deflect the king and deliver checkmate.', hint: 'Force the defending piece away from its duty.' },
            { fen: '7k/5Rpp/8/8/8/8/8/4K3 w - - 0 1', from: 'f7', answer: 'h7', legalMoves: ['a7', 'b7', 'c7', 'd7', 'e7', 'f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f8', 'g7', 'h7'], prompt: 'The rook is highlighted. Deflect the pawn and checkmate.', hint: 'Capture the pawn to remove the king\'s cover.' },
            { fen: '5rk1/6pp/8/8/8/8/8/3QK3 w - - 0 1', from: 'd1', answer: 'f1', legalMoves: ['a1', 'a4', 'b1', 'b3', 'c1', 'c2', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7', 'd8', 'e1', 'e2', 'f1', 'f3', 'g4', 'h5'], prompt: 'The queen is highlighted. Deflect the rook.', hint: 'Draw the rook away from the defence.' },
            { fen: '6k1/5ppp/8/8/5Q2/8/8/4K3 w - - 0 1', from: 'f4', answer: 'f7', legalMoves: ['a4', 'b4', 'c1', 'c4', 'd2', 'd4', 'd6', 'e3', 'e4', 'e5', 'f1', 'f2', 'f3', 'f5', 'f6', 'f7', 'f8', 'g3', 'g4', 'g5', 'h2', 'h4', 'h6'], prompt: 'The queen is highlighted. Deflect the pawn cover.', hint: 'Remove the pawn to expose the king.' }
        ],

        attraction: [
            { fen: '6k1/8/8/8/8/8/6Q1/4K3 w - - 0 1', from: 'g2', answer: 'g7', legalMoves: ['a2', 'a8', 'b2', 'b7', 'c2', 'c6', 'd2', 'd5', 'e2', 'e4', 'f1', 'f2', 'f3', 'g1', 'g3', 'g4', 'g5', 'g6', 'g7', 'g8', 'h1', 'h2', 'h3'], prompt: 'The queen is highlighted. Attract the king to a mating square.', hint: 'Lure the king to a square where it can be mated.' },
            { fen: '7k/8/6Q1/8/8/8/8/4K3 w - - 0 1', from: 'g6', answer: 'g8', legalMoves: ['a6', 'a12', 'b1', 'b6', 'c2', 'c6', 'd3', 'd6', 'e4', 'e6', 'f5', 'f6', 'f7', 'g1', 'g2', 'g3', 'g4', 'g5', 'g7', 'g8', 'h5', 'h6', 'h7'], prompt: 'The queen is highlighted. Attract the king to g8.', hint: 'Force the king onto a square where you can mate it.' },
            { fen: '7k/5R2/8/8/8/8/8/4K3 w - - 0 1', from: 'f7', answer: 'h7', legalMoves: ['a7', 'b7', 'c7', 'd7', 'e7', 'f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f8', 'g7', 'h7'], prompt: 'The rook is highlighted. Attract the king then deliver checkmate.', hint: 'Sacrifice the rook to bring the king into a mating net.' },
            { fen: '7k/8/5Q2/8/8/8/8/4K3 w - - 0 1', from: 'f6', answer: 'h6', legalMoves: ['a1', 'a6', 'b2', 'b6', 'c3', 'c6', 'd4', 'd6', 'e5', 'e6', 'e7', 'f1', 'f2', 'f3', 'f4', 'f5', 'f7', 'f8', 'g5', 'g6', 'g7', 'h4', 'h6', 'h8'], prompt: 'The queen is highlighted. Lure the king into the corner.', hint: 'Attraction forces the king where you want it.' }
        ],

        interference: [
            { fen: '3r3k/8/3Q4/8/8/8/8/3RK3 w - - 0 1', from: 'd6', answer: 'd8', legalMoves: ['a3', 'a6', 'b4', 'b6', 'c5', 'c6', 'c7', 'd1', 'd2', 'd3', 'd4', 'd5', 'd7', 'd8', 'e5', 'e6', 'e7', 'f4', 'f6', 'f8', 'g3', 'g6', 'h2', 'h6'], prompt: 'The queen is highlighted. Interfere on the back rank.', hint: 'Cut off the rook\'s defence.' },
            { fen: '7k/3r4/8/3N4/8/8/8/3RK3 w - - 0 1', from: 'd5', answer: 'f6', legalMoves: ['b4', 'b6', 'c3', 'c7', 'e3', 'e7', 'f4', 'f6'], prompt: 'The knight is highlighted. Interfere with the rook\'s defence.', hint: 'Block the defending piece\'s line.' },
            { fen: '7k/8/3r4/8/8/3Q4/8/3RK3 w - - 0 1', from: 'd3', answer: 'd6', legalMoves: ['a3', 'a6', 'b1', 'b3', 'b5', 'c2', 'c3', 'c4', 'd1', 'd2', 'd4', 'd5', 'd6', 'd7', 'd8', 'e2', 'e3', 'e4', 'f1', 'f3', 'f5', 'g3', 'g6', 'h3', 'h7'], prompt: 'The queen is highlighted. Interfere on the d-file.', hint: 'Place a piece between the defender and what it defends.' }
        ]
    };

    const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const INTERVAL_NAMES = ['Minor 2nd', 'Major 2nd', 'Minor 3rd', 'Major 3rd', 'Perfect 4th', 'Tritone', 'Perfect 5th', 'Minor 6th', 'Major 6th', 'Minor 7th', 'Major 7th', 'Octave'];

    const pick = (items) => items[Math.floor(Math.random() * items.length)];
    const shuffle = (items) => {
        const result = [...items];
        for (let i = result.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [result[i], result[j]] = [result[j], result[i]];
        }
        return result;
    };

    function getHiddenKingSquares(fen, movingSquare) {
        const files = 'abcdefgh';
        const kingSquares = [];
        let rank = 8;
        let fileIndex = 0;
        for (const piece of String(fen || '').split(' ')[0]) {
            if (piece === '/') { rank--; fileIndex = 0; continue; }
            if (/\d/.test(piece)) { fileIndex += Number(piece); continue; }
            const square = `${files[fileIndex]}${rank}`;
            if (piece.toLowerCase() === 'k' && square !== movingSquare) kingSquares.push(square);
            fileIndex++;
        }
        return kingSquares;
    }

    const TOPIC_TO_POOL = {
        fork: 'fork', forks: 'fork', 'royal fork': 'fork',
        pin: 'pin', pins: 'pin', 'absolute pin': 'pin', 'relative pin': 'pin',
        'exploiting pin': 'pin', 'complex pin': 'pin', 'cross pin': 'pin', 'piling up': 'pin',
        sacrifice: 'sacrifice', sacrifices: 'sacrifice', 'planning sacrifice': 'sacrifice', 'clearance sacrifice': 'sacrifice',
        skewer: 'skewer', skewers: 'skewer', 'smothered': 'checkmate',
        'discovered attack': 'discovered attack', 'discovered check': 'discovered attack',
        'double attack': 'discovered attack', 'double check': 'discovered attack',
        'discovered and double': 'discovered attack',
        battery: 'battery', batteries: 'battery',
        deflection: 'deflection', deflect: 'deflection',
        attraction: 'attraction', attract: 'attraction',
        interference: 'interference', interfere: 'interference', intermezzo: 'interference',
        'back rank': 'checkmate', 'mating net': 'checkmate', 'mate in 2': 'checkmate',
        'mate in 3': 'checkmate', 'long checkmate': 'checkmate', 'longer checkmate': 'checkmate',
        zugzwang: 'endgame', opposition: 'endgame', 'passed pawn': 'endgame',
        'pawn promotion': 'endgame', 'pawn race': 'endgame', 'pawn endgame': 'endgame',
        'rook endgame': 'endgame', 'bishop endgame': 'endgame', 'knight endgame': 'endgame',
    };

    function generateChessFallbackQuestions(count, topic, unitIndex) {
        const topicLower = String(topic || '').toLowerCase();
        const resolvedPool = (() => {
            for (const [keyword, pool] of Object.entries(TOPIC_TO_POOL)) {
                if (topicLower.includes(keyword)) return pool;
            }
            return Object.keys(CHESS_SAMPLES).find((key) => topicLower.includes(key)) || 'piece movement';
        })();
        const samples = CHESS_SAMPLES[resolvedPool] || CHESS_SAMPLES['piece movement'];
        const lessonNumber = Number(String(topic || '').match(/(\d+)\s*$/)?.[1]) || 0;
        const isCaptureLesson = /capturing and attacking/i.test(topicLower);
        const starTargetLesson = isCaptureLesson && lessonNumber > 0 && lessonNumber <= 3;
        const hideKings = Number.isInteger(unitIndex)
            && unitIndex >= 0
            && unitIndex < 3
            && !/king|checkmate|mate|opening|endgame/i.test(topicLower);

        return Array.from({ length: count }, (_, index) => {
            const sample = samples[(index + lessonNumber) % samples.length];
            const isCapture = sample.type === 'capture';
            return {
                type: sample.type || 'find-move',
                fen: sample.fen,
                from: sample.from,
                answer: sample.answer,
                legalMoves: sample.legalMoves,
                captureSquares: sample.captureSquares,
                hiddenPieces: hideKings ? getHiddenKingSquares(sample.fen, sample.from) : undefined,
                targetStyle: isCapture ? (starTargetLesson ? 'star' : 'piece') : undefined,
                prompt: isCapture && !starTargetLesson
                    ? sample.prompt.replace('Capture a star', 'Capture the opponent piece')
                    : sample.prompt,
                hint: sample.hint
            };
        });
    }

    function generateMusicQuestions(count, level = 1) {
        const questions = [];
        const questionTypes = level === 1 ? ['note', 'interval'] : level === 2 ? ['note', 'interval', 'chord'] : ['note', 'interval', 'chord', 'key'];
        while (questions.length < count) {
            const type = pick(questionTypes);
            if (type === 'note') {
                const clefNotes = {
                    treble: ['E4', 'F4', 'G4', 'A4', 'B4', 'C5', 'D5', 'E5', 'F5'],
                    bass: ['G2', 'A2', 'B2', 'C3', 'D3', 'E3', 'F3', 'G3', 'A3']
                };
                const clef = pick(Object.keys(clefNotes));
                const position = Math.floor(Math.random() * clefNotes[clef].length);
                const answer = clefNotes[clef][position];
                const positionName = position % 2 === 0
                    ? `line ${Math.floor(position / 2) + 1}`
                    : `space ${Math.ceil(position / 2)}`;
                const distractors = [...new Set(Object.values(clefNotes).flat().filter((note) => note !== answer))];
                questions.push({
                    type: 'multiple-choice',
                    question: `In the ${clef} clef, which pitch is on the ${positionName} from the bottom?`,
                    answer,
                    distractors: shuffle(distractors).slice(0, 3),
                    hint: clef === 'treble' ? 'The bottom line of the treble staff is E4.' : 'The bottom line of the bass staff is G2.'
                });
            } else if (type === 'interval') {
                const rootIndex = Math.floor(Math.random() * NOTE_NAMES.length);
                const semitones = 1 + Math.floor(Math.random() * 12);
                const topPosition = rootIndex + semitones;
                const root = `${NOTE_NAMES[rootIndex]}4`;
                const top = `${NOTE_NAMES[topPosition % NOTE_NAMES.length]}${4 + Math.floor(topPosition / NOTE_NAMES.length)}`;
                const answer = INTERVAL_NAMES[semitones - 1];
                questions.push({
                    type: 'multiple-choice',
                    question: `What interval is ${root} to ${top}?`,
                    answer,
                    distractors: shuffle(INTERVAL_NAMES.filter((item) => item !== answer)).slice(0, 3),
                    hint: `Count the semitones between ${root} and ${top}.`
                });
            } else if (type === 'chord') {
                const root = pick(NOTE_NAMES);
                const chordType = pick(['Major', 'Minor', 'Diminished', 'Augmented']);
                const rootIndex = NOTE_NAMES.indexOf(root);
                const third = chordType === 'Major' || chordType === 'Augmented' ? 4 : 3;
                const fifth = chordType === 'Diminished' ? 6 : chordType === 'Augmented' ? 8 : 7;
                const chordNotes = [root, NOTE_NAMES[(rootIndex + third) % 12], NOTE_NAMES[(rootIndex + fifth) % 12]];
                questions.push({
                    type: 'multiple-choice',
                    question: `The notes ${chordNotes.join('–')} form what kind of chord?`,
                    answer: `${root} ${chordType}`,
                    distractors: ['Major', 'Minor', 'Diminished', 'Augmented'].filter((item) => item !== chordType).map((item) => `${root} ${item}`),
                    hint: 'Look at the distance between the root and the third.'
                });
            } else {
                const keys = { C: '0 sharps/flats', G: '1 sharp', D: '2 sharps', A: '3 sharps', E: '4 sharps', B: '5 sharps', 'F#': '6 sharps', 'C#': '7 sharps', F: '1 flat', Bb: '2 flats', Eb: '3 flats', Ab: '4 flats', Db: '5 flats', Gb: '6 flats', Cb: '7 flats' };
                const key = pick(Object.keys(keys));
                const answer = keys[key];
                questions.push({
                    type: 'multiple-choice',
                    question: `How many sharps or flats are in the key of ${key} major?`,
                    answer,
                    distractors: shuffle(Object.values(keys).filter((item) => item !== answer)).slice(0, 3),
                    hint: 'Sharps follow F–C–G–D–A–E–B; flats go backwards.'
                });
            }
        }
        return questions;
    }

    // ═══════════════════════════════════════════════════════════════════
    //  TRANSLATE QUESTION GENERATOR
    //  Pulls from TRANSLATE_BANKS per language and topic.
    //  Per Part 8.6: wordBank is optional. Present only when non-empty.
    // ═══════════════════════════════════════════════════════════════════

    function generateTranslateQuestions(language, topic, count) {
        const bank = TRANSLATE_BANKS[language];
        if (!bank) return [];

        // Collect questions: try exact topic match first, then all topics
        const topicLower = String(topic || '').toLowerCase();
        let pool = [];

        // Try to find the best topic key match
        const topicKey = Object.keys(bank).find((k) => topicLower.includes(k.toLowerCase()) || k.toLowerCase().includes(topicLower));
        if (topicKey && bank[topicKey]) {
            pool = [...bank[topicKey]];
        }

        // If not enough, fill from all topics
        if (pool.length < count) {
            const allQuestions = Object.values(bank).flat();
            // Add questions not already in pool (by phrase)
            const poolPhrases = new Set(pool.map((q) => q.phrase));
            for (const q of allQuestions) {
                if (!poolPhrases.has(q.phrase)) {
                    pool.push(q);
                    poolPhrases.add(q.phrase);
                }
            }
        }

        // Shuffle and pick `count` items
        const selected = shuffle(pool).slice(0, count);

        return selected.map((entry) => {
            const hasWordBank = Array.isArray(entry.wordBank) && entry.wordBank.length > 0;
            const q = {
                type: 'translate',
                direction: entry.direction,
                prompt: entry.prompt,
                phrase: entry.phrase,
                answer: entry.answer,
                acceptedAnswers: entry.acceptedAnswers || [entry.answer],
                hint: entry.hint || `Translate the phrase.`
            };
            if (hasWordBank) {
                // Shuffle the word bank so tiles appear in random order
                q.wordBank = shuffle([...entry.wordBank]);
            }
            // No wordBank property at all when absent (Part 8.6: keyboard-only)
            return q;
        });
    }

    // ═══════════════════════════════════════════════════════════════════
    //  HELPERS
    // ═══════════════════════════════════════════════════════════════════

    function localizeMeaning(meaning, audienceLanguage, localize) {
        const text = String(meaning || '').trim();
        if (typeof localize === 'function') return localize(text);
        return audienceData.translations[audienceLanguage]?.[text.toLowerCase()] || text;
    }

    function resolveFallbackLanguage(language) {
        const raw = String(language || '').trim();
        if (/hindi|हिंदी|हिन्दी/i.test(raw)) return 'Hindi';
        if (/telugu|తెలుగు/i.test(raw)) return 'Telugu';
        if (/korean|한국어/i.test(raw)) return 'Korean';
        if (/japanese|日本語|nihongo/i.test(raw)) return 'Japanese';
        if (/arabic|العربية/i.test(raw)) return 'Arabic';
        if (/spanish|español|espanol/i.test(raw)) return 'Spanish';
        if (/french|français|francais/i.test(raw)) return 'French';
        if (/german|deutsch/i.test(raw)) return 'German';
        if (/italian|italiano/i.test(raw)) return 'Italian';
        if (/english/i.test(raw)) return 'English';
        return raw;
    }

    // ═══════════════════════════════════════════════════════════════════
    //  MAIN FALLBACK GENERATOR
    //  Called by lesson.js when the server returns nothing / errors out.
    //  Now includes 'translate' in the rotation for language courses.
    // ═══════════════════════════════════════════════════════════════════

    function generateFallbackQuestions(language, topic, count = 10, audienceLanguage = 'English', options = {}) {
        const normalizedLanguage = String(language || 'Spanish').trim();
        const fallbackLanguage = resolveFallbackLanguage(normalizedLanguage);
        const fallbackTopic = String(topic || 'daily practice');
        const numberOfQuestions = Math.max(0, Math.floor(Number(count)) || 0);

        // ── Chess ────────────────────────────────────────────────────
        if (fallbackLanguage === 'Chess') {
            const generated = options.generateChessQuestions?.(numberOfQuestions, 1, fallbackTopic, options.unitIndex);
            return Array.isArray(generated) && generated.length
                ? generated
                : generateChessFallbackQuestions(numberOfQuestions, fallbackTopic, options.unitIndex);
        }

        // ── Music ────────────────────────────────────────────────────
        if (fallbackLanguage === 'Music') {
            const generated = options.generateMusicQuestions?.(numberOfQuestions);
            return Array.isArray(generated) && generated.length ? generated : generateMusicQuestions(numberOfQuestions);
        }

        // ── Math ─────────────────────────────────────────────────────
        if (fallbackLanguage === 'Math') {
            return Array.from({ length: numberOfQuestions }, (_, index) => {
                const a = index + 2;
                const b = index + 3;
                const answer = a + b;
                if (index % 3 === 0) {
                    return { type: 'multiple-choice', question: `${a} + ${b} = ?`, answer: String(answer), distractors: [String(answer - 1), String(answer + 2), String(answer + 5)], hint: 'Add the numbers carefully.' };
                }
                if (index % 3 === 1) {
                    const first = a + 1;
                    const pairs = Array.from({ length: 4 }, (_, offset) => {
                        const value = first + offset;
                        return { left: `${value} + ${value}`, right: String(value * 2) };
                    });
                    return { type: 'match-pairs', pairs, hint: 'Solve each expression, then match equal values.' };
                }
                return { type: 'slider', question: `Set the answer: ${a} + ${b} = ?`, answer, min: 0, max: answer + 5, step: 1, hint: 'Add the numbers carefully.' };
            });
        }

        // ── Language courses ─────────────────────────────────────────
        const vocabLanguage = LANGUAGE_SAMPLES[fallbackLanguage] ? fallbackLanguage : 'Spanish';
        if (vocabLanguage !== fallbackLanguage) {
            console.warn(`[Musalingo] No fallback vocabulary for "${fallbackLanguage}"; showing Spanish instead.`);
        }
        const selectedSet = LANGUAGE_SAMPLES[vocabLanguage];
        const translations = ENGLISH_TRANSLATIONS[vocabLanguage];

        // Determine question type rotation based on practice mode
        const practiceQuestionTypes = {
            words: ['multiple-choice', 'match-pairs'],
            listening: ['listen'],
            speaking: ['speak'],
            speed: ['multiple-choice', 'listen']
        };

        // Base rotation: include 'translate' for all language courses (Part 8)
        const hasTranslateBank = Boolean(TRANSLATE_BANKS[vocabLanguage]);
        const baseRotation = hasTranslateBank
            ? ['multiple-choice', 'translate', 'listen', 'spell', 'translate', 'speak', 'match-pairs', 'translate']
            : ['multiple-choice', 'listen', 'spell', 'speak', 'match-pairs'];

        const questionTypes = practiceQuestionTypes[options.practiceMode] || baseRotation;

        // Pre-generate translate questions if needed
        const translateTypes = questionTypes.filter((t) => t === 'translate');
        const translateCount = Math.ceil((translateTypes.length / questionTypes.length) * numberOfQuestions);
        const translatePool = hasTranslateBank
            ? generateTranslateQuestions(vocabLanguage, fallbackTopic, Math.max(translateCount, 5))
            : [];
        let translateIndex = 0;

        const questions = Array.from({ length: numberOfQuestions }, (_, index) => {
            const sampleIndex = index % selectedSet.length;
            const [phrase, answer, distractors, pronunciation] = selectedSet[sampleIndex];
            const type = questionTypes[index % questionTypes.length];
            const translationMap = Object.fromEntries(
                [phrase, ...distractors].map((word) => [word, localizeMeaning(translations[word] || pronunciation, audienceLanguage, options.localizeMeaning)])
            );

            // ── translate ─────────────────────────────────────────
            if (type === 'translate') {
                if (translatePool.length > 0) {
                    const q = translatePool[translateIndex % translatePool.length];
                    translateIndex++;
                    return q;
                }
                // Edge case: no translate bank — fall back to multiple-choice
                return { type: 'multiple-choice', phrase, pronunciation, answer, distractors, translationMap, hint: `Practice ${fallbackTopic} words.` };
            }

            // ── multiple-choice ───────────────────────────────────
            if (type === 'multiple-choice') {
                return { type, phrase, pronunciation, answer, distractors, translationMap, hint: `Practice ${fallbackTopic} words.` };
            }

            // ── listen ────────────────────────────────────────────
            if (type === 'listen') {
                const listenDistractors = Array.from({ length: 3 }, (_, offset) =>
                    selectedSet[(sampleIndex + offset + 1) % selectedSet.length][1]
                );
                const pronunciationMap = Object.fromEntries(
                    selectedSet.map((entry) => [entry[1], entry[3]])
                );
                const listenTranslationMap = Object.fromEntries(
                    [answer, ...listenDistractors].map((choice) => [
                        choice,
                        localizeMeaning(translations[choice] || pronunciationMap[choice], audienceLanguage, options.localizeMeaning)
                    ])
                );
                return { type, phrase, answer, distractors: listenDistractors, pronunciationMap, translationMap: listenTranslationMap, hint: `Listen carefully and choose the ${fallbackTopic} word.` };
            }

            // ── spell ─────────────────────────────────────────────
            if (type === 'spell') {
                return { type, phrase, pronunciation, english: pronunciation, translation: translationMap[phrase], hint: `Listen and spell a ${fallbackTopic} word.` };
            }

            // ── speak ─────────────────────────────────────────────
            if (type === 'speak') {
                return { type, phrase, pronunciation, english: pronunciation, translation: translationMap[phrase], hint: `Say the ${fallbackTopic} word aloud.` };
            }

            // ── match-pairs ───────────────────────────────────────
            const pairs = Array.from({ length: Math.min(4, selectedSet.length) }, (_, offset) => {
                const entry = selectedSet[(index + offset) % selectedSet.length];
                const meaning = translations[entry[0]] || entry[3];
                return { left: entry[0], right: localizeMeaning(meaning, audienceLanguage, options.localizeMeaning) };
            });
            return { type: 'match-pairs', pairs, hint: `Match each ${fallbackTopic} word to its meaning.` };
        });

        // Apply audience hints if present
        const hints = audienceData.hints[audienceLanguage];
        return questions.map((question) => {
            if (hints && question.type !== 'translate') question.hint = hints[question.type] || hints.default;
            return question;
        });
    }

    // ═══════════════════════════════════════════════════════════════════
    //  PUBLIC API
    // ═══════════════════════════════════════════════════════════════════

    globalThis.MusalingoQuestions = {
        englishTranslations: ENGLISH_TRANSLATIONS,
        translateBanks: TRANSLATE_BANKS,
        generateFallbackQuestions,
        generateTranslateQuestions,
        generateMusicQuestions,
        resolveFallbackLanguage,
        supportedLanguages: Object.keys(LANGUAGE_SAMPLES),
        supportedTranslateLanguages: Object.keys(TRANSLATE_BANKS)
    };
})();