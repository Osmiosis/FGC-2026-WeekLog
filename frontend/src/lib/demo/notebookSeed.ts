import type { TimelinePayload, GapPayload, DecisionPayload, ScaffoldPayload } from "@weeklog/types";

// Pre-captured Notebook Prep reports from the live site, for the backend-free demo.
// Contributor names are pseudonymized. This is static showcase data only: the demo
// never generates anything and calls no AI.

export const timelineSeed: TimelinePayload = {
  "subsystems": [
    {
      "name": "Climber",
      "entries": [
        {
          "date": "2026-06-22",
          "kind": "build_need",
          "text": "Decide on a final build",
          "created_by": "Jordan A."
        },
        {
          "date": "2026-06-29",
          "kind": "build_need",
          "text": "Fix issues found with climber and test it on the Zone 1 prototype",
          "created_by": "Alex R."
        },
        {
          "date": "2026-06-29",
          "kind": "performance_goal",
          "text": "Climber initial prototype finished (some problems have been flagged to work on and test)",
          "created_by": "Alex R."
        },
        {
          "date": "2026-06-29",
          "kind": "failure",
          "text": "The climber is a bit loose and it's gonna fall down if we put any weight on it before of the lack of friction",
          "created_by": "Alex R."
        },
        {
          "date": "2026-07-01",
          "kind": "failure",
          "text": "Issues with climber grinding over the edges of the rod, may need more spacing, small side wheels are redundant as only the middle one is making contact",
          "created_by": "Sam K."
        },
        {
          "date": "2026-07-01",
          "kind": "accomplishment",
          "text": "Working climber prototype",
          "created_by": "Sam K."
        }
      ]
    },
    {
      "name": "Drivetrain/Collector",
      "entries": [
        {
          "date": "2026-06-15",
          "kind": "performance_goal",
          "text": "Brainstormed and decided on a drivetrain design, 4WD, with two Omni wheels in the front and two normal wheels in the back. (To avoid chain issues)\n\nStarted discussion on the intake and shooter design with how many balls we decide to target for the entire 150 second game (current aim 40), which is to be continued next meeting\n\nHolonomic drive idea was discarded as it required perfect setup and too much space",
          "created_by": "Alex R."
        },
        {
          "date": "2026-06-17",
          "kind": "performance_goal",
          "text": "Decided on a cycling shooter system (no dependence on gravity)\nNarrowed the collection and storage system to two designs\nOne limiting the stacking of balls\nOne not limiting the stacking of balls",
          "created_by": "Alex R."
        },
        {
          "date": "2026-06-17",
          "kind": "note",
          "text": "Need to finally come to a consensus on stacking or not (if we are doing stacking I think some modifications need to be made to the intake decision as I’d suggest making it a bit separate from the main storage unit) and the finally narrow down our shooter design ",
          "created_by": "Alex R."
        },
        {
          "date": "2026-06-29",
          "kind": "build_need",
          "text": "Finish the last half of the drivetrain and finish chaining",
          "created_by": "Alex R."
        },
        {
          "date": "2026-06-29",
          "kind": "build_need",
          "text": "Mount the current intake into the drivetrain and figure out optimim angle and placing location, also get to work on the agitator system after drivetrain is complete",
          "created_by": "Alex R."
        },
        {
          "date": "2026-06-29",
          "kind": "performance_goal",
          "text": "Finished one half of the drivetrain along with motor assemblies",
          "created_by": "Alex R."
        }
      ]
    },
    {
      "name": "Practice Arena",
      "entries": [
        {
          "date": "2026-06-15",
          "kind": "build_need",
          "text": "Must prepare and present bill of materials for arena by next meeting",
          "created_by": "Alex R."
        },
        {
          "date": "2026-06-17",
          "kind": "build_need",
          "text": "Confirm Arena Status",
          "created_by": "Alex R."
        },
        {
          "date": "2026-06-29",
          "kind": "build_need",
          "text": "Finish work on practice arena",
          "created_by": "Alex R."
        },
        {
          "date": "2026-06-29",
          "kind": "performance_goal",
          "text": "Practice Arena replica outlines drawn (4/5)",
          "created_by": "Alex R."
        }
      ]
    },
    {
      "name": "Programming",
      "entries": [
        {
          "date": "2026-06-29",
          "kind": "build_need",
          "text": "Program the drivetrain code along with code for the collection system and shooting (climber comes later)",
          "created_by": "Alex R."
        }
      ]
    },
    {
      "name": "Shooter",
      "entries": [
        {
          "date": "2026-06-15",
          "kind": "note",
          "text": "Prepare ideas for intake and shooter design with a detailed pros and cons list to deliberate for next meeting",
          "created_by": "Alex R."
        },
        {
          "date": "2026-06-29",
          "kind": "build_need",
          "text": "Begin work on the low wide shooter (along with the surgical tubing intake to start shooting balls)",
          "created_by": "Alex R."
        }
      ]
    },
    {
      "name": "Uncategorized",
      "entries": [
        {
          "date": "2026-06-22",
          "kind": "performance_goal",
          "text": "Decided to move the intake and keep a slight gap between the storage and intake system so that balls can be stacked easier (watch FRC), decided to move the shooter lower to avoid unnecessary time waste in funneling, narrowed down climbing to two ideas swing arm, or linear slides, climber initial idea finalized, 2 sets of 2 conical wheels with a compliant wheel spacer for climbing, need to decide position of climber in the middle or on the edge",
          "created_by": "Alex R."
        },
        {
          "date": "2026-06-24",
          "kind": "note",
          "text": "We finally came to a consensus on the final bot design:\n1. Drivetrain: Two motors with 4 wheels chaining required (2 omni in the front and 2 traction wheels (the thin ones) in the back, if the situation calls for it we could sandwitch two thin traction wheels together)\n2. Intake: Small gap from the intake and storage system, (frc style overhead intake) compliant wheels, the floor of the robot will be rows of spinning agitators (3), and one final row of surgical tubing will only spin when the shooter is ready to shoot\n3. Shooter will be kept low (max 1 surgical tubing row required to push balls to it) and balls will be pushed against the back of the robot for shooting hopefully with minimum angle\n4. Climber: The climber will either be a double pair conical wheel zipline system or a single wheel with extrusion guides, we did decide on a linear slide to reach the highes point of zone 1 (least obstruction by other bots even if they get stuck)",
          "created_by": "Alex R."
        },
        {
          "date": "2026-06-24",
          "kind": "performance_goal",
          "text": "Need to split into sub - teams next to begin working on the different parts of the robot, brainstorming phase is over",
          "created_by": "Alex R."
        },
        {
          "date": "2026-06-29",
          "kind": "performance_goal",
          "text": "Finished intake prototype (mounting, testing and agitator remains)",
          "created_by": "Alex R."
        },
        {
          "date": "2026-06-29",
          "kind": "build_need",
          "text": "Drive train 50% complete, intake started, climb mechanism prototype built, Field replica outlines drawn 4/5 panels",
          "created_by": ""
        },
        {
          "date": "2026-07-01",
          "kind": "build_need",
          "text": "Continued building the robot and field. Stated with the shooter design and agitators, build a working climber prototype that can climb with weight. Finished field panel outlines, cut out 3/5 panels. ",
          "created_by": "Sam K."
        },
        {
          "date": "2026-07-01",
          "kind": "performance_goal",
          "text": "Fix issues with drive train, widen climb mechanism, more foam board needed for supression unit replica, continue work on other tasks\n",
          "created_by": "Sam K."
        }
      ]
    }
  ],
  "photosByDate": [
    {
      "date": "2026-06-10",
      "photos": [
        {
          "caption": "Team Vietnam Zoom Meeting Photos",
          "kind": "photo"
        },
        {
          "caption": "Team Vietnam Zoom Meeting Photos",
          "kind": "photo"
        },
        {
          "caption": "Team Vietnam Zoom Meeting Photos",
          "kind": "photo"
        },
        {
          "caption": "Team Vietnam Zoom Meeting Photos",
          "kind": "photo"
        },
        {
          "caption": "Team Vietnam Zoom Meeting Photos",
          "kind": "photo"
        },
        {
          "caption": "Team Vietnam Zoom Meeting Photos",
          "kind": "photo"
        },
        {
          "caption": "Team Vietnam Zoom Meeting Photos",
          "kind": "photo"
        }
      ]
    },
    {
      "date": "2026-06-15",
      "photos": [
        {
          "caption": "",
          "kind": "photo"
        },
        {
          "caption": "",
          "kind": "photo"
        },
        {
          "caption": "",
          "kind": "photo"
        },
        {
          "caption": "",
          "kind": "photo"
        },
        {
          "caption": "Sketches",
          "kind": "photo"
        }
      ]
    },
    {
      "date": "2026-06-17",
      "photos": [
        {
          "caption": "",
          "kind": "photo"
        },
        {
          "caption": "",
          "kind": "photo"
        },
        {
          "caption": "",
          "kind": "photo"
        },
        {
          "caption": "",
          "kind": "photo"
        },
        {
          "caption": "",
          "kind": "photo"
        },
        {
          "caption": "",
          "kind": "photo"
        }
      ]
    },
    {
      "date": "2026-06-24",
      "photos": [
        {
          "caption": "Full Final Bot Design V1",
          "kind": "photo"
        },
        {
          "caption": "Random pictures of bot design",
          "kind": "photo"
        },
        {
          "caption": "Random pictures of bot design",
          "kind": "photo"
        },
        {
          "caption": "Random pictures of bot design",
          "kind": "photo"
        },
        {
          "caption": "Random pictures of bot design",
          "kind": "photo"
        },
        {
          "caption": "Random pictures of bot design",
          "kind": "photo"
        },
        {
          "caption": "Random pictures of bot design",
          "kind": "photo"
        },
        {
          "caption": "Random pictures of bot design",
          "kind": "photo"
        },
        {
          "caption": "Meeting photos ",
          "kind": "photo"
        },
        {
          "caption": "Meeting photos ",
          "kind": "photo"
        },
        {
          "caption": "Meeting photos ",
          "kind": "photo"
        },
        {
          "caption": "Meeting photos ",
          "kind": "photo"
        },
        {
          "caption": "Meeting photos ",
          "kind": "photo"
        },
        {
          "caption": "Meeting photos ",
          "kind": "photo"
        },
        {
          "caption": "Meeting photos ",
          "kind": "photo"
        },
        {
          "caption": "Meeting video",
          "kind": "video"
        }
      ]
    },
    {
      "date": "2026-06-29",
      "photos": [
        {
          "caption": "",
          "kind": "photo"
        },
        {
          "caption": "",
          "kind": "photo"
        },
        {
          "caption": "",
          "kind": "photo"
        },
        {
          "caption": "",
          "kind": "photo"
        },
        {
          "caption": "",
          "kind": "photo"
        },
        {
          "caption": "",
          "kind": "photo"
        },
        {
          "caption": "",
          "kind": "photo"
        },
        {
          "caption": "",
          "kind": "photo"
        },
        {
          "caption": "",
          "kind": "photo"
        },
        {
          "caption": "",
          "kind": "photo"
        },
        {
          "caption": "",
          "kind": "photo"
        },
        {
          "caption": "",
          "kind": "photo"
        },
        {
          "caption": "",
          "kind": "photo"
        },
        {
          "caption": "",
          "kind": "photo"
        },
        {
          "caption": "",
          "kind": "photo"
        },
        {
          "caption": "",
          "kind": "photo"
        },
        {
          "caption": "",
          "kind": "photo"
        },
        {
          "caption": "",
          "kind": "photo"
        },
        {
          "caption": "",
          "kind": "photo"
        },
        {
          "caption": "",
          "kind": "photo"
        },
        {
          "caption": "",
          "kind": "photo"
        },
        {
          "caption": "",
          "kind": "photo"
        },
        {
          "caption": "",
          "kind": "photo"
        },
        {
          "caption": "",
          "kind": "photo"
        },
        {
          "caption": "",
          "kind": "photo"
        },
        {
          "caption": "",
          "kind": "photo"
        },
        {
          "caption": "",
          "kind": "photo"
        },
        {
          "caption": "",
          "kind": "photo"
        },
        {
          "caption": "",
          "kind": "photo"
        },
        {
          "caption": "",
          "kind": "photo"
        },
        {
          "caption": "",
          "kind": "photo"
        },
        {
          "caption": "",
          "kind": "photo"
        },
        {
          "caption": "",
          "kind": "photo"
        },
        {
          "caption": "",
          "kind": "photo"
        },
        {
          "caption": "",
          "kind": "photo"
        }
      ]
    },
    {
      "date": "2026-07-01",
      "photos": [
        {
          "caption": "(only a handful rest are on the drive)",
          "kind": "photo"
        },
        {
          "caption": "(only a handful rest are on the drive)",
          "kind": "photo"
        },
        {
          "caption": "(only a handful rest are on the drive)",
          "kind": "photo"
        },
        {
          "caption": "(only a handful rest are on the drive)",
          "kind": "photo"
        },
        {
          "caption": "(only a handful rest are on the drive)",
          "kind": "photo"
        },
        {
          "caption": "(only a handful rest are on the drive)",
          "kind": "photo"
        },
        {
          "caption": "(only a handful rest are on the drive)",
          "kind": "photo"
        },
        {
          "caption": "(only a handful rest are on the drive)",
          "kind": "photo"
        }
      ]
    }
  ]
};

export const gapsSeed: GapPayload = {
  "criteria": [
    {
      "criterion": "Evidence of the engineering design process",
      "status": "thin",
      "finding": "Brainstorm and select stages are well logged (holonomic discarded 06-15, final bot design consensus 06-24) and build progress is tracked from 06-29. The test, evaluate and iterate part of the loop only appears for the Climber (loose 06-29, grinding and redundant side wheels 07-01, working prototype). Drivetrain, Intake, Shooter and Programming show brainstorm and build but no logged test or iteration.",
      "suggestions": [
        "For each subsystem add a short entry saying what you tested and what you changed as a result, not just what you built.",
        "Record at least one full iteration cycle for the Shooter and Intake the way the Climber is already documented."
      ],
      "evidence_refs": [
        {
          "date": "2026-06-24",
          "subsystem": "Drivetrain/Collector"
        },
        {
          "date": "2026-06-29",
          "subsystem": "Climber"
        },
        {
          "date": "2026-07-01",
          "subsystem": "Climber"
        }
      ]
    },
    {
      "criterion": "Lessons learned, implemented",
      "status": "thin",
      "finding": "A few lessons are recorded with the change they caused: holonomic drive dropped because it needed perfect setup and too much space (06-15), 4-wheel chosen to avoid chain issues, and the redundant side wheels on the climber flagged for removal (07-01). These are almost all Climber or drivetrain; other subsystems record what was done without the lesson behind it.",
      "suggestions": [
        "When a design changes, log the specific problem that forced the change and the fix, for every subsystem not just the climber.",
        "Revisit the intake stacking versus no-stacking question and record what you learned that finally settled it."
      ],
      "evidence_refs": [
        {
          "date": "2026-06-15",
          "subsystem": "Drivetrain/Collector"
        },
        {
          "date": "2026-07-01",
          "subsystem": "Climber"
        }
      ]
    },
    {
      "criterion": "Trade-off / cost-benefit analysis",
      "status": "thin",
      "finding": "Several decisions weighed options (holonomic versus 4-wheel, swing arm versus linear-slide climber, stacking versus non-stacking storage), but the reason recorded is short and qualitative and the rejected option is not always named. No decision weighs cost or benefit with a number. This is the single most award-relevant criterion, so thin coverage here matters most.",
      "suggestions": [
        "For each decision surfaced in the Decisions tab, write two or three sentences: the options, the one chosen, and why the others lost.",
        "Name the rejected option explicitly wherever you only recorded the winner."
      ],
      "evidence_refs": [
        {
          "date": "2026-06-15",
          "subsystem": "Drivetrain/Collector"
        },
        {
          "date": "2026-06-22",
          "subsystem": "Climber"
        },
        {
          "date": "2026-06-24",
          "subsystem": "Drivetrain/Collector"
        }
      ]
    },
    {
      "criterion": "Mathematical / physical justification",
      "status": "missing",
      "finding": "No decision is backed by a measured number. The only quantitative frame is the 40-ball target for the 150 second game (06-15), which is a goal rather than a justified figure. Climber failures are described as a bit loose and grinding with no load, force or measurement. The coverage tool counts 7 numeric entries but none carry a design-justifying number.",
      "suggestions": [
        "Add a number to each major decision: the load the climber must hold, ball cycle time, shooter range, drivetrain speed.",
        "Turn the 40-ball target into math: cycles achievable in 150 seconds times balls per cycle."
      ],
      "evidence_refs": [
        {
          "date": "2026-06-15",
          "subsystem": "Shooter"
        },
        {
          "date": "2026-06-29",
          "subsystem": "Climber"
        },
        {
          "date": "2026-07-01",
          "subsystem": "Climber"
        }
      ]
    },
    {
      "criterion": "Tests and test results",
      "status": "thin",
      "finding": "The Climber is the only subsystem with a logged test outcome (fails under weight 06-29, works as a prototype 07-01), and even there the result is an adjective, not data. No cycle times, accuracy rates, jam frequency or climb success rate are recorded for any subsystem.",
      "suggestions": [
        "When you test the shooter and intake, log the measured result: balls scored out of attempted, seconds per cycle.",
        "Re-run the climber weight test and record the actual weight it held."
      ],
      "evidence_refs": [
        {
          "date": "2026-06-29",
          "subsystem": "Climber"
        },
        {
          "date": "2026-07-01",
          "subsystem": "Climber"
        }
      ]
    },
    {
      "criterion": "Complete record over time",
      "status": "strong",
      "finding": "Documentation is spread across the season, not clustered. 15 meeting days are logged from 06-10 onward with a largest gap of 5 days, and entries appear at each meeting. This is a genuine journey record, which is exactly what the Katherine Johnson Award rewards.",
      "suggestions": [
        "Keep this cadence through build and competition prep so the record stays continuous.",
        "Backfill subsystem tags on the earlier entries so each subsystem arc is unbroken."
      ],
      "evidence_refs": [
        {
          "date": "2026-06-10",
          "subsystem": "Drivetrain/Collector"
        },
        {
          "date": "2026-06-29",
          "subsystem": "Drivetrain/Collector"
        }
      ]
    },
    {
      "criterion": "Drawings, CAD, captioned photos",
      "status": "thin",
      "finding": "There are 89 media items (76 photos, 12 docs, 1 video) but 57 are uncaptioned, and the captions that exist are generic, such as Random pictures of bot design and Team Vietnam Zoom Meeting Photos. None are tagged to a subsystem. A judge cannot tell what a photo shows or which iteration it belongs to without the team present.",
      "suggestions": [
        "Caption every photo with what it shows and which iteration or subsystem it belongs to.",
        "Tag media to a subsystem so each subsystem visual evolution can be followed."
      ],
      "evidence_refs": [
        {
          "date": "2026-06-24",
          "subsystem": "Drivetrain/Collector"
        },
        {
          "date": "2026-06-29",
          "subsystem": "Climber"
        }
      ]
    },
    {
      "criterion": "Individual contributions documented",
      "status": "missing",
      "finding": "Attendance has a single record (Member 08 on 06-15) and the log entries do not attribute who designed, built or tested each part. Judges value that every member contributed, and there is currently almost no way to show it.",
      "suggestions": [
        "Record attendance at every meeting.",
        "Add a name to major build and design entries so contributions are traceable."
      ],
      "evidence_refs": [
        {
          "date": "2026-06-15",
          "subsystem": "Practice Arena"
        }
      ]
    },
    {
      "criterion": "Clarity and structure",
      "status": "thin",
      "finding": "The raw material is readable but stored as free-text meeting notes rather than organized per subsystem with headings. Several key entries (06-22, 06-24, 07-01) are uncategorized and mix drivetrain, intake, shooter and climber in one block, which is hard for a judge to scan.",
      "suggestions": [
        "When writing the notebook, give each subsystem its own section with a heading and a chronological arc.",
        "Split the uncategorized multi-topic entries into per-subsystem notes."
      ],
      "evidence_refs": [
        {
          "date": "2026-06-22",
          "subsystem": "Climber"
        },
        {
          "date": "2026-06-24",
          "subsystem": "Drivetrain/Collector"
        }
      ]
    }
  ]
};

export const decisionsSeed: DecisionPayload = {
  "decisions": [
    {
      "title": "Chose a 4-wheel drivetrain over holonomic",
      "date": "2026-06-15",
      "subsystem": "Drivetrain/Collector",
      "chosen": "4WD with two front omni wheels and two rear traction wheels, picked to avoid chain issues; holonomic was discarded as needing perfect setup and too much space",
      "missing": [
        "numbers",
        "result"
      ],
      "prompt": "Add the numbers that back 4-wheel over holonomic (traction, speed, footprint) and record how the drivetrain performed once built and chained."
    },
    {
      "title": "Chose a cycling shooter with no dependence on gravity",
      "date": "2026-06-17",
      "subsystem": "Shooter",
      "chosen": "A cycling shooter system so feeding does not depend on gravity",
      "missing": [
        "alternatives",
        "numbers",
        "result"
      ],
      "prompt": "Record which shooter designs were considered and rejected, the numbers behind cycling (range, balls per cycle, spin-up time), and the measured test result."
    },
    {
      "title": "Kept a gap between intake and storage to allow ball stacking",
      "date": "2026-06-24",
      "subsystem": "Drivetrain/Collector",
      "chosen": "FRC-style overhead intake with a small gap to the storage so balls can stack, over the non-stacking design",
      "missing": [
        "why",
        "numbers",
        "result"
      ],
      "prompt": "Explain why the stacking design won over the non-stacking one, add the storage capacity numbers, and record whether stacking worked in testing."
    },
    {
      "title": "Lowered the shooter to cut funneling time",
      "date": "2026-06-22",
      "subsystem": "Shooter",
      "chosen": "Shooter kept low so at most one surgical-tubing row is needed to feed it, to avoid time wasted funneling",
      "missing": [
        "numbers",
        "result"
      ],
      "prompt": "Add the time saved per cycle that justified the low shooter and the measured result once built."
    },
    {
      "title": "Chose a linear-slide climber over a swing arm",
      "date": "2026-06-22",
      "subsystem": "Climber",
      "chosen": "Linear slide with two sets of two conical wheels and a compliant wheel spacer, to reach the highest point of Zone 1 with least obstruction from other robots",
      "missing": [
        "numbers"
      ],
      "prompt": "Add the load the climber must hold and the height it reaches, and the numbers that made the linear slide beat the swing arm."
    },
    {
      "title": "Widened the climber and dropped the redundant side wheels",
      "date": "2026-07-01",
      "subsystem": "Climber",
      "chosen": "Widen the climb mechanism and treat the side wheels as redundant since only the middle wheel makes contact",
      "missing": [
        "numbers",
        "result"
      ],
      "prompt": "Record the new spacing measurement and whether the widened climber held weight in the retest."
    },
    {
      "title": "Set a 40-ball scoring target for the 150-second game",
      "date": "2026-06-15",
      "subsystem": "Drivetrain/Collector",
      "chosen": "Aim for 40 balls scored across the 150 second match, driving the intake and shooter throughput targets",
      "missing": [
        "why",
        "numbers"
      ],
      "prompt": "Show the math behind 40: cycles achievable in 150 seconds times balls per cycle, and why 40 is the right target rather than higher or lower."
    }
  ]
};

export const scaffoldSeed: ScaffoldPayload = {
  "draft_notice": "DRAFT. NOT FOR SUBMISSION. Raw material and prompts for the team's engineering notebook.",
  "sections": [
    {
      "heading": "Season overview and design process",
      "raw_material": [
        "We finally came to a consensus on the final bot design: 1. Drivetrain: Two motors with 4 wheels chaining required (2 omni in the front and 2 traction wheels in the back). 2. Intake: small gap from the intake and storage system, frc style overhead intake, compliant wheels, floor of rows of spinning agitators (3), and a final row of surgical tubing that spins only when the shooter is ready. 3. Shooter kept low. 4. Climber: decided on a linear slide to reach the highest point of zone 1.",
        "Need to split into sub-teams next to begin working on the different parts of the robot, brainstorming phase is over."
      ],
      "needs": [
        "Who worked on which subsystem? Attribute design, build, and test work to named members (attendance and individual contributions are almost entirely undocumented).",
        "Reorganize the mixed meeting notes (06-22, 06-24, 07-01) into per-subsystem sections with headings so a judge can scan them."
      ]
    },
    {
      "heading": "Drivetrain and Collector",
      "raw_material": [
        "Brainstormed and decided on a drivetrain design, 4WD, two Omni wheels in the front and two normal wheels in the back (to avoid chain issues). Holonomic drive idea was discarded as it required perfect setup and too much space.",
        "Finished one half of the drivetrain along with motor assemblies.",
        "Finish the last half of the drivetrain and finish chaining.",
        "Mount the current intake into the drivetrain and figure out optimum angle and placing location, then the agitator system."
      ],
      "needs": [
        "Add the numbers behind 4-wheel over holonomic (traction, speed, footprint).",
        "Record how the drivetrain performed once built and chained: speed, pushing force, or reliability data, not adjectives."
      ]
    },
    {
      "heading": "Shooter and Intake",
      "raw_material": [
        "Decided on a cycling shooter system (no dependence on gravity). Narrowed the collection and storage system to two designs: one limiting the stacking of balls, one not limiting stacking.",
        "Kept a gap between intake and storage to allow ball stacking.",
        "Shooter kept low (max one surgical tubing row) to cut funneling time.",
        "Begin work on the low wide shooter along with the surgical tubing intake to start shooting balls."
      ],
      "needs": [
        "Which shooter designs were considered and rejected, and why did the cycling shooter win?",
        "Explain why the stacking storage won over non-stacking, and add the storage capacity numbers.",
        "Add the numbers behind cycling (range, balls per cycle, spin-up time) and the time saved per cycle by the low shooter.",
        "Record the measured test result once the shooter and intake were built."
      ]
    },
    {
      "heading": "Climber",
      "raw_material": [
        "Chose a linear-slide climber over a swing arm. Climber initial idea finalized: 2 sets of 2 conical wheels with a compliant wheel spacer.",
        "Climber initial prototype finished (some problems flagged to work on and test).",
        "The climber is a bit loose and it is gonna fall down if we put any weight on it because of the lack of friction.",
        "Issues with climber grinding over the edges of the rod, may need more spacing, small side wheels are redundant as only the middle one is making contact.",
        "Working climber prototype."
      ],
      "needs": [
        "Add the load the climber must hold and the height it reaches, and the numbers that made the linear slide beat the swing arm.",
        "Record the new spacing measurement after widening, and whether the widened climber held weight in the retest (failures are logged as adjectives, not data)."
      ]
    },
    {
      "heading": "Programming",
      "raw_material": [
        "Program the drivetrain code along with code for the collection system and shooting (climber comes later)."
      ],
      "needs": [
        "Document the programming approach and how the drivetrain, collection, and shooting code were tested and verified."
      ]
    },
    {
      "heading": "Practice Arena",
      "raw_material": [
        "Must prepare and present bill of materials for arena by next meeting.",
        "Practice Arena replica outlines drawn (4/5). Finished field panel outlines, cut out 3/5 panels."
      ],
      "needs": [
        "Note why the practice arena matters to the build and its completion status."
      ]
    },
    {
      "heading": "Strategy and scoring",
      "raw_material": [
        "Started discussion on how many balls to target for the entire 150 second game (current aim 40)."
      ],
      "needs": [
        "Show the math behind 40 balls: cycles achievable in 150 seconds times balls per cycle, and why 40 is the right target.",
        "Document alliance play strategy (FGC is alliance-based), not just your own robot in isolation."
      ]
    },
    {
      "heading": "Visuals and documentation",
      "raw_material": [],
      "needs": [
        "Caption the uncaptioned photos and tag each to a subsystem and iteration so a judge understands them without the team present.",
        "Add drawings or CAD showing design iterations, not only final builds."
      ]
    }
  ]
};
