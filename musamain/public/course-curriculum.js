window.MUSALINGO_CURRICULUM = (() => {
    // ============================================================
    //  CONFIG
    // ============================================================
    const LESSONS_PER_UNIT = 12;

    // ============================================================
    //  HELPER — expand a unit { topic, kind } into 14 lessons
    // ============================================================
    function expandUnit(prefix, sectionIndex, unitIndex, unit) {
        const topic = unit.topic || `Unit ${unitIndex + 1}`;
        const kind = unit.kind || null;
        const lessons = [];

        // --- Jump node ---
        lessons.push({
            id: `${prefix}${sectionIndex + 1}-${unitIndex + 1}-jump`,
            title: `Jump to Unit ${unitIndex + 1}`,
            description: `Test everything you have learned so far.`,
            sectionIndex,
            unitIndex,
            lessonInUnit: -1,
            isJump: true,
            kind: 'jump'
        });

        // 12 topic lessons
        for (let i = 1; i <= LESSONS_PER_UNIT; i++) {
            lessons.push({
                id: `${prefix}${sectionIndex + 1}-${unitIndex + 1}-${i}`,
                title: `${topic} ${i}`,
                description: `Practice: ${topic.toLowerCase()}.`,
                sectionIndex,
                unitIndex,
                lessonInUnit: i - 1,
                ...(kind ? { kind } : {})
            });
        }

        // 1 test (trophy)
        lessons.push({
            id: `${prefix}${sectionIndex + 1}-${unitIndex + 1}-${LESSONS_PER_UNIT + 1}`,
            title: `${topic} Test`,
            description: `Show you have mastered ${topic.toLowerCase()}.`,
            sectionIndex,
            unitIndex,
            lessonInUnit: LESSONS_PER_UNIT,
            isTest: true,
            kind: 'test'
        });

        return lessons;
    }

    // ============================================================
    //  UNIT DATA — course → sections[] → units[]
    // ============================================================
    const chessUnits = [
        // ===== Section 1 — Foundations =====
        [
            { topic: 'Piece movement', kind: 'practice' },
            { topic: 'Capturing and attacking', kind: 'capture' },
            { topic: 'Defending your pieces', kind: 'practice' },
            { topic: 'Check, attacking the king', kind: 'practice' },
            { topic: 'Checkmate, the point of the game', kind: 'puzzle' },
            { topic: 'Starting the game', kind: 'opening' }
        ],
        // ===== Section 2 — Tactics & Basics =====
        [
            { topic: 'Piece value and favorable captures', kind: 'capture' },
            { topic: 'Safety and checkmate practice', kind: 'endgame' },
            { topic: 'Practicing a match', kind: 'match' },
            { topic: 'Stalemate and checkmate patterns', kind: 'puzzle' },
            { topic: 'Exchanges', kind: 'practice' },
            { topic: 'Pawn promotion and races', kind: 'endgame' },
            { topic: 'Forks', kind: 'puzzle' },
            { topic: 'Checkmate practice', kind: 'puzzle' },
            { topic: 'Absolute pins', kind: 'puzzle' },
            { topic: 'Understanding the pawn', kind: 'practice' },
            { topic: 'Practicing planning for checkmate', kind: 'puzzle' },
            { topic: 'Continuing the opening', kind: 'opening' },
            { topic: 'Exploiting pins', kind: 'puzzle' },
            { topic: 'Smothered mate and skewers', kind: 'puzzle' },
            { topic: 'Sacrifice', kind: 'puzzle' },
            { topic: 'Discovered and double attacks', kind: 'puzzle' },
            { topic: 'Discovered and double check', kind: 'puzzle' },
            { topic: 'Checkmate tactics', kind: 'puzzle' },
            { topic: 'Battery', kind: 'puzzle' },
            { topic: 'Removing defenses and connecting rooks', kind: 'middlegame' },
            { topic: 'Gaining material', kind: 'practice' },
            { topic: 'Piling up on pins', kind: 'puzzle' },
            { topic: 'Intermediate moves', kind: 'puzzle' },
            { topic: 'Defending against mate', kind: 'endgame' },
            { topic: 'Common endgame practice', kind: 'endgame' }
        ],
        // ===== Section 3 — Intermediate Strategy & Tactics =====
        [
            { topic: 'Advanced pins', kind: 'puzzle' },
            { topic: "Forks and Lolli's mate", kind: 'puzzle' },
            { topic: 'Pins and cross pins', kind: 'puzzle' },
            { topic: 'Forcing draws', kind: 'endgame' },
            { topic: 'Escaping forks', kind: 'practice' },
            { topic: 'Escaping pins', kind: 'practice' },
            { topic: 'Mastering discovered and double attacks', kind: 'puzzle' },
            { topic: 'Understanding the rook', kind: 'practice' },
            { topic: 'Clearance sacrifice', kind: 'puzzle' },
            { topic: 'Checkmate training', kind: 'puzzle' },
            { topic: 'X-ray attacks', kind: 'puzzle' },
            { topic: 'Escaping attacks and checks', kind: 'practice' },
            { topic: 'Defending tactics', kind: 'practice' },
            { topic: 'Opposition', kind: 'endgame' },
            { topic: 'Complex pins', kind: 'puzzle' },
            { topic: 'Developing pieces', kind: 'opening' },
            { topic: 'Understanding the queen', kind: 'practice' },
            { topic: 'Early game checkmates', kind: 'opening' },
            { topic: 'Trapped pieces', kind: 'puzzle' },
            { topic: 'Opening traps', kind: 'opening' },
            { topic: 'Gaining material', kind: 'practice' },
            { topic: 'Checkmate practice', kind: 'puzzle' },
            { topic: 'Mate in 2 puzzles', kind: 'puzzle' },    // → mate-in-2
            { topic: 'Mate in 3 puzzles', kind: 'puzzle' },    // → mate-in-3
            { topic: 'Move sequences', kind: 'practice' },     // → move-sequence
        ],
        // ===== Section 4 — Intermediate Development =====
        [
            { topic: 'Checkmate practice', kind: 'puzzle' },
            { topic: 'Opening a match', kind: 'opening' },
            { topic: 'Attacking tactics', kind: 'puzzle' },
            { topic: 'Interference', kind: 'puzzle' },
            { topic: 'Escaping tactics', kind: 'practice' },
            { topic: 'Deflection', kind: 'puzzle' },
            { topic: 'Checkmate prevention', kind: 'endgame' },
            { topic: 'Mastering common endgames', kind: 'endgame' },
            { topic: 'Attraction', kind: 'puzzle' },
            { topic: 'Defending tactics', kind: 'practice' },
            { topic: 'Mastering the bishop', kind: 'practice' },
            { topic: 'Planning the checkmate', kind: 'puzzle' },
            { topic: 'Multipiece tactics', kind: 'puzzle' },
            { topic: 'Advanced pawns', kind: 'endgame' },
            { topic: 'Early game checkmates and traps', kind: 'opening' },
            { topic: 'Gaining material', kind: 'practice' },
            { topic: 'Mastering the knight', kind: 'practice' },
            { topic: 'Zugzwang', kind: 'endgame' },
            { topic: 'Mating nets', kind: 'puzzle' },
            { topic: 'Middlegame practice', kind: 'middlegame' },
            { topic: 'Planning sacrifices', kind: 'middlegame' },
            { topic: 'Isolated and backward pawns', kind: 'middlegame' },
            { topic: 'Draws, intermezzo, and zugzwang', kind: 'endgame' },
            { topic: 'Mastering the king', kind: 'endgame' }
        ],
        // ===== Section 5 — Advanced Foundations =====
        [
            { topic: 'Opposition', kind: 'endgame' },
            { topic: 'Discovered checks', kind: 'puzzle' },
            { topic: 'Knight mates', kind: 'puzzle' },
            { topic: "Doubling rooks and Alekhine's gun", kind: 'middlegame' },
            { topic: 'Sacrifices', kind: 'puzzle' },
            { topic: 'Passed pawns', kind: 'endgame' },
            { topic: 'Improving your pieces', kind: 'middlegame' },
            { topic: 'Early game tactics', kind: 'opening' },
            { topic: 'Improving your rooks and queen', kind: 'middlegame' },
            { topic: 'Rook and bishop mates', kind: 'puzzle' },
            { topic: 'Pawn races and breakthroughs', kind: 'endgame' },
            { topic: 'Knowing when to trade', kind: 'middlegame' },
            { topic: 'More rook mates', kind: 'puzzle' },
            { topic: 'Bishop attacks', kind: 'puzzle' },
            { topic: 'Pawn power', kind: 'endgame' },
            { topic: 'Queen and bishop mates', kind: 'puzzle' },
            { topic: 'Queen forks', kind: 'puzzle' },
            { topic: 'Shouldering and zugzwang', kind: 'endgame' },
            { topic: 'Bishop pair mates', kind: 'puzzle' },
            { topic: 'Rooks on the pawn row', kind: 'middlegame' },
            { topic: 'Attacks on a castled king', kind: 'middlegame' },
            { topic: 'Rook and knight mates', kind: 'puzzle' },
            { topic: 'Interference and intermezzo', kind: 'puzzle' },
            { topic: 'Minor piece checkmates', kind: 'puzzle' }
        ],
        // ===== Section 6 — Advanced Tactics =====
        [
            { topic: 'Practicing checkmating patterns', kind: 'puzzle' },
            { topic: 'Opening repertoire', kind: 'opening' },
            { topic: 'Defending tactics', kind: 'practice' },
            { topic: 'Discovered attacks', kind: 'puzzle' },
            { topic: 'Mastering the knight', kind: 'practice' },
            { topic: 'Attacking tactics', kind: 'puzzle' },
            { topic: 'Gaining advantage in the early game', kind: 'opening' },
            { topic: 'Mastering the pawn', kind: 'endgame' },
            { topic: 'Planning sacrifices', kind: 'middlegame' },
            { topic: 'Practicing frequent checkmates', kind: 'puzzle' },
            { topic: 'Middlegame practice', kind: 'middlegame' },
            { topic: 'Exploiting mistakes', kind: 'puzzle' },
            { topic: 'Mastering the king', kind: 'endgame' },
            { topic: 'Multipiece tactics', kind: 'puzzle' },
            { topic: 'Obtaining the advantage', kind: 'middlegame' },
            { topic: 'Surprising your opponent', kind: 'puzzle' },
            { topic: 'Improving your position', kind: 'middlegame' },
            { topic: 'Mastering the queen', kind: 'practice' },
            { topic: 'Endgame practice', kind: 'endgame' },
            { topic: 'Avoiding attacks', kind: 'practice' },
            { topic: 'Mastering the rook', kind: 'practice' },
            { topic: 'Mastering checkmates', kind: 'puzzle' },
            { topic: 'Mastering the seventh rank', kind: 'middlegame' },
            { topic: 'Mastering the bishop', kind: 'practice' },
            { topic: 'Disadvantages', kind: 'middlegame' },
            { topic: 'Tricky endgames', kind: 'endgame' },
            { topic: 'Attraction and clearance', kind: 'puzzle' },
            { topic: 'Midgame tactics I', kind: 'middlegame' },
            { topic: 'Balanced focus I', kind: 'middlegame' },
            { topic: 'Longer checkmates I', kind: 'puzzle' },
            { topic: 'Clearance and deflection', kind: 'puzzle' },
            { topic: 'Attraction and midgame', kind: 'middlegame' },
            { topic: 'Midgame tactics II', kind: 'middlegame' },
            { topic: 'Balanced focus II', kind: 'middlegame' },
            { topic: 'Endgames I', kind: 'endgame' },
            { topic: 'Endgames II', kind: 'endgame' },
            { topic: 'Midgame tactics III', kind: 'middlegame' },
            { topic: 'Rook and queen endgames', kind: 'endgame' },
            { topic: 'Bishop and knight endgames', kind: 'endgame' },
            { topic: 'Checkmate practice', kind: 'puzzle' },
            { topic: 'Discovered and double attacks', kind: 'puzzle' },
            { topic: 'Longer checkmates II', kind: 'puzzle' },
            { topic: 'Balanced focus III', kind: 'middlegame' },
            { topic: 'Pawn endgames and promotions', kind: 'endgame' },
            { topic: 'Deflection and attraction', kind: 'puzzle' },
            { topic: 'Winning pieces', kind: 'practice' },
            { topic: 'Balanced focus IV', kind: 'middlegame' },
            { topic: 'Early game', kind: 'opening' }
        ],
        // ===== Section 7 — Master Level =====
        [
            { topic: 'Midgame tactics I', kind: 'middlegame' },
            { topic: 'Rook and queen endgames', kind: 'endgame' },
            { topic: 'Bishop and knight endgames', kind: 'endgame' },
            { topic: 'Checkmate practice', kind: 'puzzle' },
            { topic: 'Discovered and double attacks I', kind: 'puzzle' },
            { topic: 'Longer checkmates', kind: 'puzzle' },
            { topic: 'Balanced focus', kind: 'middlegame' },
            { topic: 'Pawn endgames and promotions', kind: 'endgame' },
            { topic: 'Deflection and attraction', kind: 'puzzle' },
            { topic: 'Winning pieces', kind: 'practice' },
            { topic: 'Balanced focus', kind: 'middlegame' },
            { topic: 'Early game', kind: 'opening' },
            { topic: 'Disadvantages', kind: 'middlegame' },
            { topic: 'Tricky endgames', kind: 'endgame' },
            { topic: 'Attraction and clearance', kind: 'puzzle' },
            { topic: 'Midgame tactics II', kind: 'middlegame' },
            { topic: 'Balanced focus', kind: 'middlegame' },
            { topic: 'Longer checkmates', kind: 'puzzle' },
            { topic: 'Clearance and deflection', kind: 'puzzle' },
            { topic: 'Attraction and midgame', kind: 'middlegame' },
            { topic: 'Midgame tactics III', kind: 'middlegame' },
            { topic: 'Balanced focus', kind: 'middlegame' },
            { topic: 'Endgames I', kind: 'endgame' },
            { topic: 'Endgames II', kind: 'endgame' },
            { topic: 'Strategic balance I', kind: 'middlegame' },
            { topic: 'Checkmate mastery I', kind: 'puzzle' },
            { topic: 'Tactical precision', kind: 'puzzle' },
            { topic: 'Positional play', kind: 'middlegame' },
            { topic: 'Advanced tactics I', kind: 'puzzle' },
            { topic: 'Strategic balance II', kind: 'middlegame' },
            { topic: 'Complex endgames I', kind: 'endgame' },
            { topic: 'Complex endgames II', kind: 'endgame' },
            { topic: 'Advanced tactics II', kind: 'puzzle' },
            { topic: 'Complex endgames III', kind: 'endgame' },
            { topic: 'Piece endgames', kind: 'endgame' },
            { topic: 'Checkmate mastery II', kind: 'puzzle' },
            { topic: 'Advanced discovered attacks', kind: 'puzzle' },
            { topic: 'Long checkmates', kind: 'puzzle' },
            { topic: 'Strategic balance III', kind: 'middlegame' },
            { topic: 'Pawn structure', kind: 'middlegame' },
            { topic: 'Tactical combinations I', kind: 'puzzle' },
            { topic: 'Material advantage', kind: 'middlegame' },
            { topic: 'Strategic balance IV', kind: 'middlegame' },
            { topic: 'Opening principles', kind: 'opening' },
            { topic: 'Comeback tactics', kind: 'puzzle' },
            { topic: 'Endgame finesse', kind: 'endgame' },
            { topic: 'Tactical combinations II', kind: 'puzzle' },
            { topic: 'Advanced tactics III', kind: 'puzzle' }
        ]
    ];

    // ============================================================
    //  LANGUAGE UNIT DATA
    // ============================================================
    const languageUnits = {
        japanese: [
            [{ topic: 'Greetings' }, { topic: 'Everyday words' }, { topic: 'Numbers and time' }, { topic: 'Useful questions' }],
            [{ topic: 'Food and ordering' }, { topic: 'Getting around' }, { topic: 'Shopping' }, { topic: 'Daily routine' }],
            [{ topic: 'Making plans' }, { topic: 'At the hotel' }, { topic: 'Weather and seasons' }, { topic: 'Putting it together' }],
            [{ topic: 'Past events' }, { topic: 'Future plans' }, { topic: 'Emotions' }, { topic: 'Opinions' }],
            [{ topic: 'Storytelling' }, { topic: 'Describing people' }, { topic: 'Describing places' }, { topic: 'Comparatives' }],
            [{ topic: 'Reading signs' }, { topic: 'Reading menus' }, { topic: 'Forms' }, { topic: 'Appointments' }],
            [{ topic: 'Debate basics' }, { topic: 'Agree and disagree' }, { topic: 'Problem solving' }, { topic: 'Summarizing' }]
        ],
        spanish: [
            [{ topic: 'Greetings' }, { topic: 'Daily phrases' }, { topic: 'Numbers and time' }, { topic: 'Travel phrases' }],
            [{ topic: 'Food and ordering' }, { topic: 'Getting around' }, { topic: 'Shopping' }, { topic: 'Daily routine' }],
            [{ topic: 'Making plans' }, { topic: 'At the hotel' }, { topic: 'Weather and seasons' }, { topic: 'Family and friends' }],
            [{ topic: 'Past events' }, { topic: 'Future plans' }, { topic: 'Emotions' }, { topic: 'Opinions' }],
            [{ topic: 'Storytelling' }, { topic: 'Describing people' }, { topic: 'Describing places' }, { topic: 'Comparatives' }],
            [{ topic: 'Reading signs' }, { topic: 'Reading menus' }, { topic: 'Forms' }, { topic: 'Appointments' }],
            [{ topic: 'Debate basics' }, { topic: 'Agree and disagree' }, { topic: 'Problem solving' }, { topic: 'Summarizing' }]
        ],
        french: [
            [{ topic: 'Basic words' }, { topic: 'Numbers' }, { topic: 'At the café' }, { topic: 'Directions' }],
            [{ topic: 'Food and ordering' }, { topic: 'Getting around' }, { topic: 'Shopping' }, { topic: 'Daily routine' }],
            [{ topic: 'Making plans' }, { topic: 'At the hotel' }, { topic: 'Weather and seasons' }, { topic: 'Making friends' }],
            [{ topic: 'Past events' }, { topic: 'Future plans' }, { topic: 'Emotions' }, { topic: 'Opinions' }],
            [{ topic: 'Storytelling' }, { topic: 'Describing people' }, { topic: 'Describing places' }, { topic: 'Comparatives' }],
            [{ topic: 'Reading signs' }, { topic: 'Reading menus' }, { topic: 'Forms' }, { topic: 'Appointments' }],
            [{ topic: 'Debate basics' }, { topic: 'Agree and disagree' }, { topic: 'Problem solving' }, { topic: 'Summarizing' }]
        ],
        german: [
            [{ topic: 'Travel basics' }, { topic: 'Introductions' }, { topic: 'Food' }, { topic: 'Directions' }],
            [{ topic: 'Food and ordering' }, { topic: 'Getting around' }, { topic: 'Shopping' }, { topic: 'Daily routine' }],
            [{ topic: 'Making plans' }, { topic: 'At the hotel' }, { topic: 'Weather and seasons' }, { topic: 'Cases' }],
            [{ topic: 'Past events' }, { topic: 'Future plans' }, { topic: 'Emotions' }, { topic: 'Opinions' }],
            [{ topic: 'Storytelling' }, { topic: 'Describing people' }, { topic: 'Describing places' }, { topic: 'Comparatives' }],
            [{ topic: 'Reading signs' }, { topic: 'Reading menus' }, { topic: 'Forms' }, { topic: 'Appointments' }],
            [{ topic: 'Debate basics' }, { topic: 'Agree and disagree' }, { topic: 'Problem solving' }, { topic: 'Summarizing' }]
        ],
        italian: [
            [{ topic: 'Food and travel' }, { topic: 'Travel basics' }, { topic: 'Numbers' }, { topic: 'Shopping' }],
            [{ topic: 'Food and ordering' }, { topic: 'Getting around' }, { topic: 'Shopping basics' }, { topic: 'Daily routine' }],
            [{ topic: 'Making plans' }, { topic: 'At the hotel' }, { topic: 'Weather and seasons' }, { topic: 'Making friends' }],
            [{ topic: 'Past events' }, { topic: 'Future plans' }, { topic: 'Emotions' }, { topic: 'Opinions' }],
            [{ topic: 'Storytelling' }, { topic: 'Describing people' }, { topic: 'Describing places' }, { topic: 'Comparatives' }],
            [{ topic: 'Reading signs' }, { topic: 'Reading menus' }, { topic: 'Forms' }, { topic: 'Appointments' }],
            [{ topic: 'Debate basics' }, { topic: 'Agree and disagree' }, { topic: 'Problem solving' }, { topic: 'Summarizing' }]
        ],
        hindi: [
            [{ topic: 'Devangiri basics' }, { topic: 'Everyday words' }, { topic: 'Helpful phrases' }, { topic: 'Numbers' }, { topic: 'Family' }],
            [{ topic: 'Food and ordering' }, { topic: 'Getting around' }, { topic: 'Shopping' }, { topic: 'Daily routine' }],
            [{ topic: 'Making plans' }, { topic: 'At the hotel' }, { topic: 'Weather and seasons' }, { topic: 'Making friends' }],
            [{ topic: 'Past events' }, { topic: 'Future plans' }, { topic: 'Emotions' }, { topic: 'Opinions' }],
            [{ topic: 'Storytelling' }, { topic: 'Describing people' }, { topic: 'Describing places' }, { topic: 'Comparatives' }],
            [{ topic: 'Reading signs' }, { topic: 'Reading menus' }, { topic: 'Forms' }, { topic: 'Appointments' }],
            [{ topic: 'Debate basics' }, { topic: 'Agree and disagree' }, { topic: 'Problem solving' }, { topic: 'Summarizing' }]
        ],
        arabic: [
            [{ topic: 'Starter words' }, { topic: 'Helpful phrases' }, { topic: 'Numbers' }, { topic: 'Family' }],
            [{ topic: 'Food and ordering' }, { topic: 'Getting around' }, { topic: 'Shopping' }, { topic: 'Daily routine' }],
            [{ topic: 'Making plans' }, { topic: 'At the hotel' }, { topic: 'Weather and seasons' }, { topic: 'Making friends' }],
            [{ topic: 'Past events' }, { topic: 'Future plans' }, { topic: 'Emotions' }, { topic: 'Opinions' }],
            [{ topic: 'Storytelling' }, { topic: 'Describing people' }, { topic: 'Describing places' }, { topic: 'Comparatives' }],
            [{ topic: 'Reading signs' }, { topic: 'Reading menus' }, { topic: 'Forms' }, { topic: 'Appointments' }],
            [{ topic: 'Debate basics' }, { topic: 'Agree and disagree' }, { topic: 'Problem solving' }, { topic: 'Summarizing' }]
        ],
        english: [
            [{ topic: 'Starter phrases' }, { topic: 'Everyday sentences' }, { topic: 'Daily listening' }, { topic: 'At work' }, { topic: 'Travel' }],
            [{ topic: 'Introductions' }, { topic: 'Food and ordering' }, { topic: 'Getting around' }, { topic: 'Everyday routines' }],
            [{ topic: 'Making plans' }, { topic: 'Shopping' }, { topic: 'At work and school' }, { topic: 'Describing people' }],
            [{ topic: 'Past events' }, { topic: 'Future plans' }, { topic: 'Emotions' }, { topic: 'Opinions' }],
            [{ topic: 'Storytelling' }, { topic: 'Describing places' }, { topic: 'Comparatives' }, { topic: 'Conditionals' }],
            [{ topic: 'Reading signs' }, { topic: 'Reading menus' }, { topic: 'Forms' }, { topic: 'Appointments' }],
            [{ topic: 'Debate basics' }, { topic: 'Agree and disagree' }, { topic: 'Problem solving' }, { topic: 'Summarizing' }]
        ],
        'intermediate-english': [
            [{ topic: 'Advanced Phrases' }, { topic: 'Everyday Sentences' }, { topic: 'Daily Listening' }, { topic: 'At Work' }, { topic: 'Travel' }],
            [{ topic: 'Complex Introductions' }, { topic: 'Dining Out' }, { topic: 'Navigation' }, { topic: 'Routines' }],
            [{ topic: 'Making Plans' }, { topic: 'Shopping' }, { topic: 'Work and School' }, { topic: 'Describing People' }],
            [{ topic: 'Past Events' }, { topic: 'Future Plans' }, { topic: 'Emotions' }, { topic: 'Opinions' }],
            [{ topic: 'Storytelling' }, { topic: 'Describing Places' }, { topic: 'Comparatives' }, { topic: 'Conditionals' }],
            [{ topic: 'Reading Signs' }, { topic: 'Reading Menus' }, { topic: 'Forms' }, { topic: 'Appointments' }],
            [{ topic: 'Debate Basics' }, { topic: 'Agreeing and Disagreeing' }, { topic: 'Problem Solving' }, { topic: 'Summarizing' }]
        ],
        korean: [
            [{ topic: 'Hangul basics' }, { topic: 'Greetings' }, { topic: 'Numbers' }, { topic: 'Everyday words' }],
            [{ topic: 'Food and ordering' }, { topic: 'Getting around' }, { topic: 'Shopping' }, { topic: 'Daily routine' }],
            [{ topic: 'Making plans' }, { topic: 'At the hotel' }, { topic: 'Weather' }, { topic: 'Putting it together' }],
            [{ topic: 'Past events' }, { topic: 'Future plans' }, { topic: 'Emotions' }, { topic: 'Opinions' }],
            [{ topic: 'Storytelling' }, { topic: 'Describing people' }, { topic: 'Describing places' }, { topic: 'Comparatives' }],
            [{ topic: 'Reading signs' }, { topic: 'Reading menus' }, { topic: 'Forms' }, { topic: 'Appointments' }],
            [{ topic: 'Debate basics' }, { topic: 'Agree and disagree' }, { topic: 'Problem solving' }, { topic: 'Summarizing' }]
        ],
        telugu: [
            [{ topic: 'Telugu script basics' }, { topic: 'Greetings' }, { topic: 'Numbers' }, { topic: 'Everyday words' }],
            [{ topic: 'Food and ordering' }, { topic: 'Getting around' }, { topic: 'Shopping' }, { topic: 'Daily routine' }],
            [{ topic: 'Making plans' }, { topic: 'At the hotel' }, { topic: 'Weather' }, { topic: 'Putting it together' }],
            [{ topic: 'Past events' }, { topic: 'Future plans' }, { topic: 'Emotions' }, { topic: 'Opinions' }],
            [{ topic: 'Storytelling' }, { topic: 'Describing people' }, { topic: 'Describing places' }, { topic: 'Comparatives' }],
            [{ topic: 'Reading signs' }, { topic: 'Reading menus' }, { topic: 'Forms' }, { topic: 'Appointments' }],
            [{ topic: 'Debate basics' }, { topic: 'Agree and disagree' }, { topic: 'Problem solving' }, { topic: 'Summarizing' }]
        ]
    };

    // ============================================================
    //  MATH CURRICULUM (Dynamic by Grade)
    // ============================================================
    const mathUnits = {
        'grade-1': [
            [{ topic: 'Counting 1-10' }, { topic: 'Addition to 10' }, { topic: 'Subtraction to 10' }, { topic: 'Shapes' }],
            [{ topic: 'Counting 11-20' }, { topic: 'Addition to 20' }, { topic: 'Subtraction to 20' }, { topic: 'Patterns' }],
            [{ topic: 'Place Value' }, { topic: 'Measurement' }, { topic: 'Time' }, { topic: 'Money' }]
        ],
        'grade-2': [
            [{ topic: 'Addition to 100' }, { topic: 'Subtraction to 100' }, { topic: 'Place Value' }, { topic: 'Shapes' }],
            [{ topic: 'Multiplication basics' }, { topic: 'Division basics' }, { topic: 'Measurement' }, { topic: 'Time' }],
            [{ topic: 'Fractions' }, { topic: 'Money' }, { topic: 'Data and Graphs' }, { topic: 'Word Problems' }]
        ],
        'grade-3': [
            [{ topic: 'Multiplication tables' }, { topic: 'Division facts' }, { topic: 'Fractions' }, { topic: 'Geometry' }],
            [{ topic: 'Area and Perimeter' }, { topic: 'Time and Money' }, { topic: 'Data' }, { topic: 'Word Problems' }],
            [{ topic: 'Decimals' }, { topic: 'Measurement' }, { topic: 'Patterns' }, { topic: 'Mixed Practice' }]
        ],
        'grade-4': [
            [{ topic: 'Multi-digit Multiplication' }, { topic: 'Long Division' }, { topic: 'Fractions' }, { topic: 'Decimals' }],
            [{ topic: 'Geometry' }, { topic: 'Measurement' }, { topic: 'Data' }, { topic: 'Word Problems' }],
            [{ topic: 'Factors and Multiples' }, { topic: 'Patterns' }, { topic: 'Mixed Practice' }, { topic: 'Problem Solving' }]
        ],
        'grade-5': [
            [{ topic: 'Fractions' }, { topic: 'Decimals' }, { topic: 'Percentages' }, { topic: 'Geometry' }],
            [{ topic: 'Volume' }, { topic: 'Measurement' }, { topic: 'Data' }, { topic: 'Word Problems' }],
            [{ topic: 'Ratios' }, { topic: 'Patterns' }, { topic: 'Mixed Practice' }, { topic: 'Problem Solving' }]
        ],
        'grade-6': [
            [{ topic: 'Ratios and Proportions' }, { topic: 'Percentages' }, { topic: 'Integers' }, { topic: 'Geometry' }],
            [{ topic: 'Algebra Basics' }, { topic: 'Equations' }, { topic: 'Data and Statistics' }, { topic: 'Word Problems' }],
            [{ topic: 'Coordinate Plane' }, { topic: 'Area and Volume' }, { topic: 'Mixed Practice' }, { topic: 'Problem Solving' }]
        ],
        'grade-7': [
            [{ topic: 'Algebra Basics' }, { topic: 'Equations' }, { topic: 'Inequalities' }, { topic: 'Geometry' }],
            [{ topic: 'Ratios' }, { topic: 'Proportions' }, { topic: 'Data' }, { topic: 'Probability' }],
            [{ topic: 'Graphing' }, { topic: 'Mixed Practice' }, { topic: 'Word Problems' }, { topic: 'Problem Solving' }]
        ],
        'grade-8': [
            [{ topic: 'Algebra' }, { topic: 'Linear Equations' }, { topic: 'Functions' }, { topic: 'Geometry' }],
            [{ topic: 'Systems of Equations' }, { topic: 'Exponents' }, { topic: 'Data' }, { topic: 'Probability' }],
            [{ topic: 'Pythagorean Theorem' }, { topic: 'Mixed Practice' }, { topic: 'Word Problems' }, { topic: 'Problem Solving' }]
        ],
        'grade-9': [
            [{ topic: 'Algebra' }, { topic: 'Linear Equations' }, { topic: 'Quadratic Equations' }, { topic: 'Geometry' }],
            [{ topic: 'Polynomials' }, { topic: 'Functions' }, { topic: 'Data' }, { topic: 'Probability' }],
            [{ topic: 'Trigonometry Basics' }, { topic: 'Mixed Practice' }, { topic: 'Word Problems' }, { topic: 'Problem Solving' }]
        ],
        'grade-10': [
            [{ topic: 'Advanced Algebra' }, { topic: 'Quadratics' }, { topic: 'Trigonometry' }, { topic: 'Geometry' }],
            [{ topic: 'Sequences and Series' }, { topic: 'Functions' }, { topic: 'Data' }, { topic: 'Probability' }],
            [{ topic: 'Limits' }, { topic: 'Mixed Practice' }, { topic: 'Word Problems' }, { topic: 'Problem Solving' }]
        ],
        'fun-math': [
            [{ topic: 'Math Puzzles' }, { topic: 'Number Games' }, { topic: 'Logic Puzzles' }, { topic: 'Brain Teasers' }],
            [{ topic: 'Patterns' }, { topic: 'Shapes' }, { topic: 'Speed Math' }, { topic: 'Fun Challenges' }],
            [{ topic: 'Mixed Practice' }, { topic: 'Problem Solving' }, { topic: 'Games' }, { topic: 'Trivia' }]
        ],
        'adult-math': [
            [{ topic: 'Everyday Math' }, { topic: 'Budgeting' }, { topic: 'Percentages' }, { topic: 'Measurements' }],
            [{ topic: 'Data and Statistics' }, { topic: 'Probability' }, { topic: 'Ratios' }, { topic: 'Word Problems' }],
            [{ topic: 'Algebra Basics' }, { topic: 'Geometry' }, { topic: 'Mixed Practice' }, { topic: 'Problem Solving' }]
        ]
    };

    const musicUnits = [
        [{ topic: 'Rhythm' }, { topic: 'Note Names' }, { topic: 'Scales' }, { topic: 'Chords' }],
        [{ topic: 'Beat and Meter' }, { topic: 'Intervals' }, { topic: 'Key Signatures' }, { topic: 'Chord Progressions' }],
        [{ topic: 'Rhythm Patterns' }, { topic: 'Melody' }, { topic: 'Dynamics and Tempo' }, { topic: 'Ensemble Practice' }],
        [{ topic: 'Treble Clef' }, { topic: 'Bass Clef' }, { topic: 'Time Signatures' }, { topic: 'Dotted Notes' }],
        [{ topic: 'Baroque Period' }, { topic: 'Classical Period' }, { topic: 'Romantic Period' }, { topic: 'Modern Period' }],
        [{ topic: 'Ear Training' }, { topic: 'Sight Reading' }, { topic: 'Improvisation' }, { topic: 'Composition' }],
        [{ topic: 'Advanced Harmony' }, { topic: 'Counterpoint' }, { topic: 'Sonata Form' }, { topic: 'Analysis' }]
    ];

    const unitData = {
        ...languageUnits,
        chess: chessUnits,
        math: mathUnits,
        music: musicUnits
    };

    // ============================================================
    //  COURSE METADATA
    // ============================================================
    const courseDetails = {
        telugu: ['Telugu', 'New', 'Learn Telugu from script basics to everyday conversation.', '🇮🇳'],
        korean: ['Korean', 'New', 'Learn Korean from Hangul to everyday conversation.', '🇰🇷'],
        japanese: ['Japanese', 'New', 'Start with useful Japanese words and phrases for everyday conversations.', '🇯🇵'],
        spanish: ['Spanish', 'New', 'Practical Spanish for travel, work, and everyday conversations.', '🇪🇸'],
        french: ['French', 'New', 'A friendly starting point for speaking and understanding French.', '🇫🇷'],
        german: ['German', 'New', 'A simple beginner course for travel and daily life.', '🇩🇪'],
        italian: ['Italian', 'Level 1', 'A warm and fun path to speaking Italian.', '🇮🇹'],
        hindi: ['Hindi', 'New', 'A beginner-friendly course for everyday Hindi phrases.', '🇮🇳'],
        arabic: ['Arabic', 'New', 'Start with key phrases for everyday situations.', '🇸🇦'],
        english: ['English', 'Level 3', 'Grammar, speaking, and reading with structured lessons.', '🇬🇧'],
        'intermediate-english': ['Intermediate English', 'Level 3', 'Advanced grammar, idioms, and fluent conversation for native speakers.', '🇬🇧'],
        chess: ['Chess', 'New', 'Train strategy with pure board interaction.', '♞'],
        math: ['Math', 'New', 'Interactive drills — MC, match, sliders, graphs.', '➗'],
        music: ['Music', 'New', 'Explore rhythm, tempo, and notes.', '🎵']
    };

    const prefixes = {
        // ── Indian languages ─────────────────────────────
        hindi: 'hi', telugu: 'te', tamil: 'ta', kannada: 'kn', bengali: 'bn', marathi: 'mr', malayalam: 'ml', gujarati: 'gu', punjabi: 'pa', odia: 'or', assamese: 'as',
        // ── Asian languages ──────────────────────────────
        japanese: 'jp', korean: 'kr', chinese: 'zh', nepali: 'ne', urdu: 'ur',
        // ── European languages ───────────────────────────
        spanish: 'es', french: 'fr', german: 'de', italian: 'it', portuguese: 'pt', russian: 'ru', dutch: 'nl',
        // ── Middle Eastern / other ───────────────────────
        arabic: 'ar', hebrew: 'he', turkish: 'tr', persian: 'fa', swahili: 'sw',
        // ── Small and Pretend languages ──────────────────
        latin:'la',
        // ── English ──────────────────────────────────────
        english: 'en', 'intermediate-english': 'ie',
        // ── Skill paths ──────────────────────────────────
        chess: 'ch', math: 'ma', music: 'mu'
    };

    // ============================================================
    //  BUILD COURSES (FIXED MATH CRASH)
    // ============================================================
    const courses = Object.fromEntries(
        Object.entries(unitData).map(([id, sectionGroups]) => {
            const [name, level, description, icon] = courseDetails[id];
            const prefix = prefixes[id];

            let lessons = [];
            let totalSections = 0;

            if (id === 'math') {
                // Math is an object of grades. Default to grade-1 structure.
                const defaultGrade = sectionGroups['grade-1'];
                if (defaultGrade) {
                    lessons = defaultGrade.flatMap((sectionUnits, sectionIndex) =>
                        sectionUnits.flatMap((unit, unitIndex) =>
                            expandUnit(prefix, sectionIndex, unitIndex, unit)
                        )
                    );
                    totalSections = defaultGrade.length;
                }
            } else {
                // Languages/Chess/Music are Arrays
                lessons = sectionGroups.flatMap((sectionUnits, sectionIndex) =>
                    sectionUnits.flatMap((unit, unitIndex) =>
                        expandUnit(prefix, sectionIndex, unitIndex, unit)
                    )
                );
                totalSections = sectionGroups.length;
            }

            return [id, {
                id, name, level, description, icon,
                lessons,
                totalSections
            }];
        })
    );

    // ============================================================
    //  CATALOG GROUPS
    // ============================================================
    const catalogGroups = [
        { audience: 'For English speakers', courseIds: ['japanese', 'spanish', 'french', 'hindi', 'arabic', 'italian', 'german', 'english', 'korean', 'telugu'] },
        { audience: 'For Spanish speakers', courseIds: ['english', 'german', 'italian', 'japanese'] },
        { audience: 'For French speakers', courseIds: ['english', 'german', 'italian'] },
        { audience: 'For Japanese speakers', courseIds: ['english', 'korean'] },
        { audience: 'For Hindi speakers', courseIds: ['english', 'italian', 'arabic', 'telugu'] },
        { audience: 'Special skill paths', courseIds: ['chess', 'math', 'music'] }
    ];

    // ============================================================
    //  SECTION DATA
    // ============================================================
    const sectionData = {
        chess: [
            { id: 'c1', sectionNo: 1, label: 'FOUNDATIONS', status: 'active', progress: 0, speech: { jp: 'Piece movement', romaji: 'learn the basics' }, cat: '♟️' },
            { id: 'c2', sectionNo: 2, label: 'TACTICS & BASICS', status: 'locked', progress: 0, speech: { jp: 'Tactics', romaji: 'captures, forks, pins' }, cat: '♞' },
            { id: 'c3', sectionNo: 3, label: 'INTERMEDIATE STRATEGY', status: 'locked', progress: 0, speech: { jp: 'Strategy', romaji: 'advanced pins and forks' }, cat: '♝' },
            { id: 'c4', sectionNo: 4, label: 'INTERMEDIATE DEVELOPMENT', status: 'locked', progress: 0, speech: { jp: 'Development', romaji: 'openings and middlegame' }, cat: '♜' },
            { id: 'c5', sectionNo: 5, label: 'ADVANCED FOUNDATIONS', status: 'locked', progress: 0, speech: { jp: 'Advanced', romaji: 'endgames and mates' }, cat: '♛' },
            { id: 'c6', sectionNo: 6, label: 'ADVANCED TACTICS', status: 'locked', progress: 0, speech: { jp: 'Mastery', romaji: 'long combinations' }, cat: '♚' },
            { id: 'c7', sectionNo: 7, label: 'MASTER LEVEL', status: 'locked', progress: 0, speech: { jp: 'GM level', romaji: 'deep calculation' }, cat: '♔' }
        ],
        japanese: [
            { id: 'j1', sectionNo: 1, label: 'A1.1', status: 'active', progress: 0, speech: { jp: 'こんにちは！', romaji: 'ko n ni chi wa' }, cat: '🐈' },
            { id: 'j2', sectionNo: 2, label: 'A1.2', status: 'locked', progress: 0, speech: { jp: 'ありがとう', romaji: 'a ri ga to u' }, cat: '🐈' },
            { id: 'j3', sectionNo: 3, label: 'A2.1', status: 'locked', progress: 0, speech: { jp: 'げんきですか', romaji: 'gen ki de su ka' }, cat: '🐈' },
            { id: 'j4', sectionNo: 4, label: 'A2.2', status: 'locked', progress: 0, speech: { jp: 'きのう', romaji: 'ki no u' }, cat: '🐈' },
            { id: 'j5', sectionNo: 5, label: 'B1', status: 'locked', progress: 0, speech: { jp: 'ものがたり', romaji: 'mo no ga ta ri' }, cat: '🐈' },
            { id: 'j6', sectionNo: 6, label: 'B2', status: 'locked', progress: 0, speech: { jp: 'しんだい', romaji: 'shin dai' }, cat: '🐈' },
            { id: 'j7', sectionNo: 7, label: 'C1', status: 'locked', progress: 0, speech: { jp: 'とうろん', romaji: 'to u ron' }, cat: '🐈' }
        ],
        spanish: [
            { id: 's1', sectionNo: 1, label: 'A1.1', status: 'active', progress: 0, speech: { jp: '¡Hola!', romaji: 'o la' }, cat: '🐈' },
            { id: 's2', sectionNo: 2, label: 'A1.2', status: 'locked', progress: 0, speech: { jp: 'Me gusta.', romaji: 'me gus ta' }, cat: '🐈' },
            { id: 's3', sectionNo: 3, label: 'A2.1', status: 'locked', progress: 0, speech: { jp: '¿Dónde está?', romaji: 'don de es ta' }, cat: '🐈' },
            { id: 's4', sectionNo: 4, label: 'A2.2', status: 'locked', progress: 0, speech: { jp: 'Ayer fui.', romaji: 'a yer fui' }, cat: '🐈' },
            { id: 's5', sectionNo: 5, label: 'B1', status: 'locked', progress: 0, speech: { jp: 'Cuentos.', romaji: 'cuen tos' }, cat: '🐈' },
            { id: 's6', sectionNo: 6, label: 'B2', status: 'locked', progress: 0, speech: { jp: 'Formularios.', romaji: 'for mu la rios' }, cat: '🐈' },
            { id: 's7', sectionNo: 7, label: 'C1', status: 'locked', progress: 0, speech: { jp: 'Debate.', romaji: 'de ba te' }, cat: '🐈' }
        ],
        french: [
            { id: 'f1', sectionNo: 1, label: 'A1.1', status: 'active', progress: 0, speech: { jp: 'Bonjour !', romaji: 'bon jour' }, cat: '🐈' },
            { id: 'f2', sectionNo: 2, label: 'A1.2', status: 'locked', progress: 0, speech: { jp: 'Merci !', romaji: 'mer si' }, cat: '🐈' },
            { id: 'f3', sectionNo: 3, label: 'A2.1', status: 'locked', progress: 0, speech: { jp: 'Où ?', romaji: 'u' }, cat: '🐈' },
            { id: 'f4', sectionNo: 4, label: 'A2.2', status: 'locked', progress: 0, speech: { jp: 'Hier.', romaji: 'i er' }, cat: '🐈' },
            { id: 'f5', sectionNo: 5, label: 'B1', status: 'locked', progress: 0, speech: { jp: 'Raconter.', romaji: 'ra con ter' }, cat: '🐈' },
            { id: 'f6', sectionNo: 6, label: 'B2', status: 'locked', progress: 0, speech: { jp: 'Formulaires.', romaji: 'for mu lair' }, cat: '🐈' },
            { id: 'f7', sectionNo: 7, label: 'C1', status: 'locked', progress: 0, speech: { jp: 'Débat.', romaji: 'de ba' }, cat: '🐈' }
        ],
        german: [
            { id: 'g1', sectionNo: 1, label: 'A1.1', status: 'active', progress: 0, speech: { jp: 'Hallo!', romaji: 'ha lo' }, cat: '🐈' },
            { id: 'g2', sectionNo: 2, label: 'A1.2', status: 'locked', progress: 0, speech: { jp: 'Danke!', romaji: 'dan ke' }, cat: '🐈' },
            { id: 'g3', sectionNo: 3, label: 'A2.1', status: 'locked', progress: 0, speech: { jp: 'Wo?', romaji: 'vo' }, cat: '🐈' },
            { id: 'g4', sectionNo: 4, label: 'A2.2', status: 'locked', progress: 0, speech: { jp: 'Gestern.', romaji: 'ges tern' }, cat: '🐈' },
            { id: 'g5', sectionNo: 5, label: 'B1', status: 'locked', progress: 0, speech: { jp: 'Erzählen.', romaji: 'er tsä len' }, cat: '🐈' },
            { id: 'g6', sectionNo: 6, label: 'B2', status: 'locked', progress: 0, speech: { jp: 'Formulare.', romaji: 'for mu la re' }, cat: '🐈' },
            { id: 'g7', sectionNo: 7, label: 'C1', status: 'locked', progress: 0, speech: { jp: 'Diskussion.', romaji: 'dis ku ssi on' }, cat: '🐈' }
        ],
        italian: [
            { id: 'i1', sectionNo: 1, label: 'A1.1', status: 'active', progress: 0, speech: { jp: 'Ciao!', romaji: 'chao' }, cat: '🐈' },
            { id: 'i2', sectionNo: 2, label: 'A1.2', status: 'locked', progress: 0, speech: { jp: 'Grazie!', romaji: 'grat tsie' }, cat: '🐈' },
            { id: 'i3', sectionNo: 3, label: 'A2.1', status: 'locked', progress: 0, speech: { jp: 'Dove?', romaji: 'do ve' }, cat: '🐈' },
            { id: 'i4', sectionNo: 4, label: 'A2.2', status: 'locked', progress: 0, speech: { jp: 'Ieri.', romaji: 'ie ri' }, cat: '🐈' },
            { id: 'i5', sectionNo: 5, label: 'B1', status: 'locked', progress: 0, speech: { jp: 'Raccontare.', romaji: 'rak kon ta re' }, cat: '🐈' },
            { id: 'i6', sectionNo: 6, label: 'B2', status: 'locked', progress: 0, speech: { jp: 'Moduli.', romaji: 'mo du li' }, cat: '🐈' },
            { id: 'i7', sectionNo: 7, label: 'C1', status: 'locked', progress: 0, speech: { jp: 'Dibattito.', romaji: 'di bat ti to' }, cat: '🐈' }
        ],
        hindi: [
            { id: 'h1', sectionNo: 1, label: 'A1.1', status: 'active', progress: 0, speech: { jp: 'नमस्ते!', romaji: 'na mas te' }, cat: '🐈' },
            { id: 'h2', sectionNo: 2, label: 'A1.2', status: 'locked', progress: 0, speech: { jp: 'धन्यवाद।', romaji: 'dhan ya vaad' }, cat: '🐈' },
            { id: 'h3', sectionNo: 3, label: 'A2.1', status: 'locked', progress: 0, speech: { jp: 'कहाँ?', romaji: 'ka haan' }, cat: '🐈' },
            { id: 'h4', sectionNo: 4, label: 'A2.2', status: 'locked', progress: 0, speech: { jp: 'कल।', romaji: 'kal' }, cat: '🐈' },
            { id: 'h5', sectionNo: 5, label: 'B1', status: 'locked', progress: 0, speech: { jp: 'कहानी।', romaji: 'ka haa ni' }, cat: '🐈' },
            { id: 'h6', sectionNo: 6, label: 'B2', status: 'locked', progress: 0, speech: { jp: 'फॉर्म।', romaji: 'form' }, cat: '🐈' },
            { id: 'h7', sectionNo: 7, label: 'C1', status: 'locked', progress: 0, speech: { jp: 'बहस।', romaji: 'ba has' }, cat: '🐈' }
        ],
        arabic: [
            { id: 'a1', sectionNo: 1, label: 'A1.1', status: 'active', progress: 0, speech: { jp: 'مرحبا', romaji: 'mar ha ban' }, cat: '🐈' },
            { id: 'a2', sectionNo: 2, label: 'A1.2', status: 'locked', progress: 0, speech: { jp: 'شكرا', romaji: 'shuk ran' }, cat: '🐈' },
            { id: 'a3', sectionNo: 3, label: 'A2.1', status: 'locked', progress: 0, speech: { jp: 'أين', romaji: 'ai na' }, cat: '🐈' },
            { id: 'a4', sectionNo: 4, label: 'A2.2', status: 'locked', progress: 0, speech: { jp: 'أمس', romaji: 'ams' }, cat: '🐈' },
            { id: 'a5', sectionNo: 5, label: 'B1', status: 'locked', progress: 0, speech: { jp: 'قصة', romaji: 'qis sa' }, cat: '🐈' },
            { id: 'a6', sectionNo: 6, label: 'B2', status: 'locked', progress: 0, speech: { jp: 'نموذج', romaji: 'na mu thaj' }, cat: '🐈' },
            { id: 'a7', sectionNo: 7, label: 'C1', status: 'locked', progress: 0, speech: { jp: 'نقاش', romaji: 'ni qash' }, cat: '🐈' }
        ],
        english: [
            { id: 'e1', sectionNo: 1, label: 'A1.1', status: 'active', progress: 0, speech: { jp: 'Hello!', romaji: 'he lo' }, cat: '🐈' },
            { id: 'e2', sectionNo: 2, label: 'A1.2', status: 'locked', progress: 0, speech: { jp: 'Thank you.', romaji: 'thank you' }, cat: '🐈' },
            { id: 'e3', sectionNo: 3, label: 'A2.1', status: 'locked', progress: 0, speech: { jp: 'Where?', romaji: 'where' }, cat: '🐈' },
            { id: 'e4', sectionNo: 4, label: 'A2.2', status: 'locked', progress: 0, speech: { jp: 'Yesterday.', romaji: 'yes ter day' }, cat: '🐈' },
            { id: 'e5', sectionNo: 5, label: 'B1', status: 'locked', progress: 0, speech: { jp: 'Stories.', romaji: 'sto ries' }, cat: '🐈' },
            { id: 'e6', sectionNo: 6, label: 'B2', status: 'locked', progress: 0, speech: { jp: 'Forms.', romaji: 'forms' }, cat: '🐈' },
            { id: 'e7', sectionNo: 7, label: 'C1', status: 'locked', progress: 0, speech: { jp: 'Debate.', romaji: 'de bate' }, cat: '🐈' }
        ],
        'intermediate-english': [
            { id: 'ie1', sectionNo: 1, label: 'B1.1', status: 'active', progress: 0, speech: { jp: 'Let\'s get started', romaji: 'lets get star ted' }, cat: '🐈' },
            { id: 'ie2', sectionNo: 2, label: 'B1.2', status: 'locked', progress: 0, speech: { jp: 'I appreciate it', romaji: 'I ap pre ci ate it' }, cat: '🐈' },
            { id: 'ie3', sectionNo: 3, label: 'B2.1', status: 'locked', progress: 0, speech: { jp: 'Where is it?', romaji: 'where is it' }, cat: '🐈' },
            { id: 'ie4', sectionNo: 4, label: 'B2.2', status: 'locked', progress: 0, speech: { jp: 'The other day', romaji: 'the o ther day' }, cat: '🐈' },
            { id: 'ie5', sectionNo: 5, label: 'C1.1', status: 'locked', progress: 0, speech: { jp: 'Anecdotes', romaji: 'an ec dotes' }, cat: '🐈' },
            { id: 'ie6', sectionNo: 6, label: 'C1.2', status: 'locked', progress: 0, speech: { jp: 'Paperwork', romaji: 'pa per work' }, cat: '🐈' },
            { id: 'ie7', sectionNo: 7, label: 'C2', status: 'locked', progress: 0, speech: { jp: 'Discussion', romaji: 'dis cus sion' }, cat: '🐈' }
        ],
        korean: [
            { id: 'k1', sectionNo: 1, label: 'A1.1', status: 'active', progress: 0, speech: { jp: '안녕하세요!', romaji: 'an nyeong ha se yo' }, cat: '🐈' },
            { id: 'k2', sectionNo: 2, label: 'A1.2', status: 'locked', progress: 0, speech: { jp: '감사합니다', romaji: 'gam sa ham ni da' }, cat: '🐈' },
            { id: 'k3', sectionNo: 3, label: 'A2.1', status: 'locked', progress: 0, speech: { jp: '어디예요?', romaji: 'eo di ye yo' }, cat: '🐈' },
            { id: 'k4', sectionNo: 4, label: 'A2.2', status: 'locked', progress: 0, speech: { jp: '어제', romaji: 'eo je' }, cat: '🐈' },
            { id: 'k5', sectionNo: 5, label: 'B1', status: 'locked', progress: 0, speech: { jp: '이야기', romaji: 'i ya gi' }, cat: '🐈' },
            { id: 'k6', sectionNo: 6, label: 'B2', status: 'locked', progress: 0, speech: { jp: '양식', romaji: 'yang sik' }, cat: '🐈' },
            { id: 'k7', sectionNo: 7, label: 'C1', status: 'locked', progress: 0, speech: { jp: '토론', romaji: 'to ron' }, cat: '🐈' }
        ],
        telugu: [
            { id: 't1', sectionNo: 1, label: 'A1.1', status: 'active', progress: 0, speech: { jp: 'నమస్కారం!', romaji: 'na mas kaa ram' }, cat: '🐈' },
            { id: 't2', sectionNo: 2, label: 'A1.2', status: 'locked', progress: 0, speech: { jp: 'ధన్యవాదాలు', romaji: 'dhan ya vaa daa lu' }, cat: '🐈' },
            { id: 't3', sectionNo: 3, label: 'A2.1', status: 'locked', progress: 0, speech: { jp: 'ఎక్కడ?', romaji: 'ek ka da' }, cat: '🐈' },
            { id: 't4', sectionNo: 4, label: 'A2.2', status: 'locked', progress: 0, speech: { jp: 'నిన్న', romaji: 'nin na' }, cat: '🐈' },
            { id: 't5', sectionNo: 5, label: 'B1', status: 'locked', progress: 0, speech: { jp: 'కథ', romaji: 'ka tha' }, cat: '🐈' },
            { id: 't6', sectionNo: 6, label: 'B2', status: 'locked', progress: 0, speech: { jp: 'ఫారం', romaji: 'phaa ram' }, cat: '🐈' },
            { id: 't7', sectionNo: 7, label: 'C1', status: 'locked', progress: 0, speech: { jp: 'చర్చ', romaji: 'char cha' }, cat: '🐈' }
        ],
        math: [
            { id: 'm1', sectionNo: 1, label: 'GRADE 1', status: 'active', progress: 0, speech: { jp: '2 + 3 = ?', romaji: 'two plus three' }, cat: '🐈' },
            { id: 'm2', sectionNo: 2, label: 'GRADE 2', status: 'locked', progress: 0, speech: { jp: '5 × 6 = ?', romaji: 'five times six' }, cat: '🐈' },
            { id: 'm3', sectionNo: 3, label: 'GRADE 3', status: 'locked', progress: 0, speech: { jp: '12 ÷ 4 = ?', romaji: 'twelve divided by four' }, cat: '🐈' },
            { id: 'm4', sectionNo: 4, label: 'GRADE 4', status: 'locked', progress: 0, speech: { jp: 'Decimal?', romaji: 'de ci mal' }, cat: '🐈' },
            { id: 'm5', sectionNo: 5, label: 'GRADE 5', status: 'locked', progress: 0, speech: { jp: 'Mean?', romaji: 'mean' }, cat: '🐈' },
            { id: 'm6', sectionNo: 6, label: 'GRADE 6', status: 'locked', progress: 0, speech: { jp: 'Solve x.', romaji: 'solve x' }, cat: '🐈' },
            { id: 'm7', sectionNo: 7, label: 'GRADE 7', status: 'locked', progress: 0, speech: { jp: 'Limit?', romaji: 'li mit' }, cat: '🐈' }
        ],
        music: [
            { id: 'u1', sectionNo: 1, label: 'A1.1', status: 'active', progress: 0, speech: { jp: 'Do Re Mi', romaji: 'do re mi' }, cat: '🐈' },
            { id: 'u2', sectionNo: 2, label: 'A1.2', status: 'locked', progress: 0, speech: { jp: 'Fa Sol La', romaji: 'fa sol la' }, cat: '🐈' },
            { id: 'u3', sectionNo: 3, label: 'A2.1', status: 'locked', progress: 0, speech: { jp: 'Ti Do', romaji: 'ti do' }, cat: '🐈' },
            { id: 'u4', sectionNo: 4, label: 'A2.2', status: 'locked', progress: 0, speech: { jp: 'Baroque', romaji: 'ba roque' }, cat: '🐈' },
            { id: 'u5', sectionNo: 5, label: 'B1', status: 'locked', progress: 0, speech: { jp: 'Ear training', romaji: 'ear trai ning' }, cat: '🐈' },
            { id: 'u6', sectionNo: 6, label: 'B2', status: 'locked', progress: 0, speech: { jp: 'Counterpoint', romaji: 'coun ter point' }, cat: '🐈' },
            { id: 'u7', sectionNo: 7, label: 'C1', status: 'locked', progress: 0, speech: { jp: 'Composition', romaji: 'com po si tion' }, cat: '🐈' }
        ]
    };

    const defaultSections = [
        { id: 'u1', sectionNo: 1, label: 'A1.1', status: 'active', progress: 0, speech: { jp: 'Hello!', romaji: 'he lo' }, cat: '🐈' },
        { id: 'u2', sectionNo: 2, label: 'A1.2', status: 'locked', progress: 0, speech: { jp: 'Keep going!', romaji: 'keep go ing' }, cat: '🐈' },
        { id: 'u3', sectionNo: 3, label: 'A2.1', status: 'locked', progress: 0, speech: { jp: 'Halfway!', romaji: 'half way' }, cat: '🐈' },
        { id: 'u4', sectionNo: 4, label: 'A2.2', status: 'locked', progress: 0, speech: { jp: 'Almost!', romaji: 'al most' }, cat: '🐈' },
        { id: 'u5', sectionNo: 5, label: 'B1', status: 'locked', progress: 0, speech: { jp: 'Advanced!', romaji: 'ad vanced' }, cat: '🐈' },
        { id: 'u6', sectionNo: 6, label: 'B2', status: 'locked', progress: 0, speech: { jp: 'Final stretch!', romaji: 'fi nal' }, cat: '🐈' },
        { id: 'u7', sectionNo: 7, label: 'C1', status: 'locked', progress: 0, speech: { jp: 'Done!', romaji: 'done' }, cat: '🐈' }
    ];

    const unitTopics = Object.fromEntries(
        Object.entries(unitData).map(([id, sectionGroups]) => {
            // FIX: Handle Math (which is an object of grades)
            if (id === 'math') {
                // Default to grade-1 for the unitTopics display
                const defaultGrade = sectionGroups['grade-1'] || [];
                return [
                    id,
                    defaultGrade.map(section =>
                        section.map(unit => unit.topic || 'Unit')
                    )
                ];
            }

            // Handle languages/chess/music (which are arrays)
            return [
                id,
                sectionGroups.map(section =>
                    section.map(unit => unit.topic || 'Unit')
                )
            ];
        })
    );

    const pathConfig = {
        lessonsPerUnit: LESSONS_PER_UNIT + 2,   // jump + 12 + test
        testPosition: LESSONS_PER_UNIT + 1,
        jumpPosition: -1
    };

    // ============================================================
    //  PUBLIC FUNCTIONS
    // ============================================================

    function getMathUnits(experience) {
        return unitData.math?.[experience] || unitData.math?.['grade-1'] || [];
    }

    function getCourseUnitTopics(courseId, experience) {
        const sections = courseId === 'math'
            ? getMathUnits(experience)
            : unitData[courseId];
        if (!Array.isArray(sections)) return [];
        return sections.map(section => section.map(unit => unit.topic || 'Unit'));
    }

    function getCourseLessons(courseId, savedLessons = [], experience = null) {
        const definition = courses[courseId];
        if (!definition) return [];
        const saved = Array.isArray(savedLessons) ? savedLessons : [];
        const seen = new Set();
        const lessonDefinitions = courseId === 'math'
            ? getMathUnits(experience).flatMap((sectionUnits, sectionIndex) =>
                sectionUnits.flatMap((unit, unitIndex) =>
                    expandUnit(prefixes[courseId], sectionIndex, unitIndex, unit)
                )
            )
            : definition.lessons;

        // Build fresh lessons from the definition
        const lessons = lessonDefinitions.map(lesson => {
            const previous = saved.find(item => item && item.id === lesson.id);
            seen.add(lesson.id);
            return previous ? { ...lesson, ...previous } : { ...lesson, completed: false };
        });

        // Only carry over saved lessons that match the NEW id format
        const prefix = prefixes[courseId];
        saved.forEach(lesson => {
            if (!lesson || !lesson.id || seen.has(lesson.id)) return;
            const parts = lesson.id.split('-');
            const matchesFormat =
                lesson.id.startsWith(prefix) &&
                parts.length === 3;
            if (matchesFormat) {
                lessons.push({ ...lesson });
                seen.add(lesson.id);
            }
        });

        return lessons;
    }

    function buildDisplayLessons(courseLessons, courseId, sectionIndex = 0) {
        const inSection = (Array.isArray(courseLessons) ? courseLessons : [])
            .filter(lesson => (lesson.sectionIndex ?? 0) === sectionIndex);

        const unitMap = new Map();
        inSection.forEach(lesson => {
            const u = lesson.unitIndex ?? 0;
            if (!unitMap.has(u)) unitMap.set(u, []);
            unitMap.get(u).push(lesson);
        });

        const unitIndices = [...unitMap.keys()].sort((a, b) => a - b);

        const lessons = [];
        unitIndices.forEach((unitIdx, displayUnitIndex) => {
            const unitLessons = unitMap.get(unitIdx);
            unitLessons.forEach((lesson, lessonInUnit) => {
                const isTest = !!lesson.isTest;
                const isJump = !!lesson.isJump;
                lessons.push({
                    ...lesson,
                    displayUnitIndex,
                    lessonInUnit,
                    isTest,
                    isJump
                });
            });
        });

        return {
            lessons,
            totalUnits: unitIndices.length,
            lessonsPerUnit: pathConfig.lessonsPerUnit
        };
    }

    function getLessonIcon(courseId, lesson, index) {
        const kind = String(lesson.kind || '').toLowerCase().trim();

        if (kind === 'jump' || lesson.isJump) return '⏩';
        if (kind === 'test' || lesson.isTest) return '🏆';

        if (courseId === 'chess') {
            const icons = {
                opening: '♘', practice: '♞', capture: '♞', match: '♖',
                drill: '🏋️', puzzle: '♛', endgame: '♔', middlegame: '♝'
            };
            if (icons[kind]) return icons[kind];

            const title = String(lesson.title || '').toLowerCase();
            if (/movement|pawn/.test(title)) return '♟';
            if (/capture|fork/.test(title)) return '♞';
            if (/checkmate|tactic/.test(title)) return '♛';
            if (/king|endgame/.test(title)) return '♔';
            if (/pin|skewer|defend/.test(title)) return '♝';
            if (/opening/.test(title)) return '♖';
            return ['♟', '♞', '♝', '♜', '♛', '♚'][index % 6];
        }

        if (courseId === 'math') return ['➕', '✖️', '➖', '➗'][index % 4];

        if (index === 0) return '✦';
        return courses[courseId]?.icon || '★';
    }

    return {
        courses,
        catalogGroups,
        sections: sectionData,
        defaultSections,
        unitTopics,
        getCourseUnitTopics,
        pathConfig,
        getCourseLessons,
        buildDisplayLessons,
        getLessonIcon
    };
})();