window.MusalingoAudience = {
    languageCodes: {
        English: 'en',
        Spanish: 'es',
        French: 'fr',
        Japanese: 'ja',
        Hindi: 'hi'
    },
    languageNames: {
        Spanish: { English: 'inglés', Japanese: 'japonés', Spanish: 'español', French: 'francés', German: 'alemán', Italian: 'italiano', Hindi: 'hindi', Arabic: 'árabe', Korean: 'coreano', Telugu: 'telugu' },
        French: { English: 'anglais', Japanese: 'japonais', Spanish: 'espagnol', French: 'français', German: 'allemand', Italian: 'italien', Hindi: 'hindi', Arabic: 'arabe', Korean: 'coréen', Telugu: 'télougou' },
        Japanese: { English: '英語', Japanese: '日本語', Spanish: 'スペイン語', French: 'フランス語', German: 'ドイツ語', Italian: 'イタリア語', Hindi: 'ヒンディー語', Arabic: 'アラビア語', Korean: '韓国語', Telugu: 'テルグ語' },
        Hindi: { English: 'अंग्रेज़ी', Japanese: 'जापानी', Spanish: 'स्पैनिश', French: 'फ़्रेंच', German: 'जर्मन', Italian: 'इतालवी', Hindi: 'हिंदी', Arabic: 'अरबी', Korean: 'कोरियाई', Telugu: 'तेलुगु' }
    },
    translations: {
        Spanish: { cat: 'gato', hello: 'hola', goodbye: 'adiós', 'thank you': 'gracias', please: 'por favor', friend: 'amigo', water: 'agua', house: 'casa', home: 'casa', book: 'libro', school: 'escuela', happy: 'feliz', food: 'comida', morning: 'mañana', night: 'noche', car: 'coche', music: 'música', rain: 'lluvia', well: 'bien', run: 'correr', door: 'puerta', table: 'mesa', apple: 'manzana', window: 'ventana', moon: 'luna', sun: 'sol', 'see you later': 'hasta luego' },
        French: { cat: 'chat', hello: 'bonjour', goodbye: 'au revoir', 'thank you': 'merci', please: 's’il vous plaît', friend: 'ami', water: 'eau', house: 'maison', home: 'maison', book: 'livre', school: 'école', happy: 'heureux', food: 'nourriture', morning: 'matin', night: 'nuit', car: 'voiture', music: 'musique', rain: 'pluie', well: 'bien', run: 'courir', door: 'porte', table: 'table', apple: 'pomme', window: 'fenêtre', moon: 'lune', sun: 'soleil' },
        Japanese: { cat: '猫', hello: 'こんにちは', goodbye: 'さようなら', 'thank you': 'ありがとう', please: 'お願いします', friend: '友達', water: '水', house: '家', home: '家', book: '本', school: '学校', happy: 'うれしい', food: '食べ物', morning: '朝', night: '夜', car: '車', music: '音楽', rain: '雨', well: '元気', run: '走る', door: 'ドア', table: 'テーブル', apple: 'りんご', window: '窓', moon: '月', sun: '太陽' },
        Hindi: { cat: 'बिल्ली', hello: 'नमस्ते', goodbye: 'अलविदा', 'thank you': 'धन्यवाद', please: 'कृपया', friend: 'मित्र', water: 'पानी', house: 'घर', home: 'घर', book: 'किताब', school: 'विद्यालय', happy: 'खुश', food: 'खाना', morning: 'सुबह', night: 'रात', car: 'गाड़ी', music: 'संगीत', rain: 'बारिश', well: 'अच्छा', run: 'दौड़ना', door: 'दरवाज़ा', table: 'मेज़', apple: 'सेब', window: 'खिड़की', moon: 'चाँद', sun: 'सूरज' }
    },
    hints: {
        Spanish: { default: 'Tómate tu tiempo.', 'multiple-choice': 'Practica el vocabulario del tema.', listen: 'Escucha y elige la palabra correcta.', spell: 'Escucha y escribe la palabra.', speak: 'Di la frase en voz alta.', 'match-pairs': 'Une cada palabra con su significado.' },
        French: { default: 'Prenez votre temps.', 'multiple-choice': 'Entraînez-vous avec le vocabulaire du thème.', listen: 'Écoutez et choisissez le bon mot.', spell: 'Écoutez et écrivez le mot.', speak: 'Dites la phrase à voix haute.', 'match-pairs': 'Associez chaque mot à sa signification.' },
        Japanese: { default: '落ち着いて考えてください。', 'multiple-choice': 'テーマの単語を練習しましょう。', listen: '聞こえた単語を選んでください。', spell: '聞こえた単語を書いてください。', speak: 'フレーズを声に出してください。', 'match-pairs': '単語と意味を組み合わせてください。' },
        Hindi: { default: 'आराम से सोचें。', 'multiple-choice': 'इस विषय के शब्दों का अभ्यास करें।', listen: 'सुनकर सही शब्द चुनें।', spell: 'सुनकर शब्द लिखें।', speak: 'वाक्य को ज़ोर से बोलें।', 'match-pairs': 'शब्दों को उनके अर्थ से मिलाएँ।' }
    },
    catalogGroups: [
        { audience: 'For English speakers', courseIds: ['japanese', 'spanish', 'french', 'hindi', 'arabic', 'italian', 'german', 'english', 'korean', 'telugu'] },
        { audience: 'For Spanish speakers', courseIds: ['english', 'german', 'italian', 'japanese'] },
        { audience: 'For French speakers', courseIds: ['english', 'german', 'italian'] },
        { audience: 'For Japanese speakers', courseIds: ['english', 'korean'] },
        { audience: 'For Hindi speakers', courseIds: ['english', 'italian', 'arabic', 'telugu'] },
        { audience: 'Special skill paths', courseIds: ['chess', 'math', 'music'] }
    ]
};
