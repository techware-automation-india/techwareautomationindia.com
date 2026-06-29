import machineCardSorting from "../assets/machine-card-sorting.jpg";
import machineQrValidation from "../assets/machine-qr-validation.jpg";
import machineCardFeeding from "../assets/machine-card-feeding.jpg";
import machineConveyorInspection from "../assets/machine-conveyor-inspection.jpg";

import mechienRfid from "../assets/RFID.jpg"
import mechineTorsionTester from "../assets/torsionTester.jpg"
import mechineSheetCollationMachine from "../assets/sheetCollationMachine.jpg"
import mechineCardLaserMechine from "../assets/cardLaserMarker.jpg"
import mechineModulePushpullTester from "../assets/modulePushpullTester.jpg"
import mechineManualAtr from "../assets/manualAtr.jpg"
import mechineManualImada from "../assets/manualmada.jpg"
import laserFumeExtractor from "../assets/Laser_Fume_Extractor.jpg"
import labelApplicatorMachine from "../assets/Label_Applicator_Machine.jpg"
import dualHeadCardPunchingMachine  from "../assets/Dual_Head_Card_Punching_Machine.jpg"
import acs from "../assets/acs.jpg"
import pc_based_atr from "../assets/PC_based_ATR.jpg"

const machines = [
  {
    name: "RFID Brushing Machine",
    image: mechienRfid,
    desc: "The RFID Brushing Machine is a precision surface preparation and cleaning system designed for RFID card and smart card manufacturing. It removes dust, burrs, adhesive residues, and surface contaminants from RFID inlays and card substrates, ensuring superior lamination quality, enhanced RFID performance, and consistent product reliability. Equipped with controlled brushing technology and integrated vacuum dust extraction, the machine delivers high-quality surface finishing while protecting delicate RFID antenna structures and embedded chip components.",
    features: [
      "High-Precision Surface Brushing",
      "RFID Inlay Cleaning & Preparation",
      "Integrated Vacuum Dust Collection",
      "Adjustable Brush Pressure Control",
      "Anti-Static Cleaning Process",
      "Consistent Surface Finishing",
      "Continuous Production Operation",
      "Industrial Grade Construction",
      "Low Maintenance Design",
      "Enhanced Quality Assurance"
    ],
  },
  {
  name: "PC-Based Online ACS Tester",
  image: acs,
  desc: "Advanced PC-Based Online ACS Tester designed for automatic smart card validation using ACS readers. It provides real-time card testing, pass/fail detection, data logging, and seamless PLC integration for efficient quality control in smart card production.",
  features: [
    "ACS Reader Integration",
    "Real-Time Card Testing",
    "Automatic Pass/Fail",
    "PC-Based Software",
    "PLC Integration",
    "Data Logging & Reports"
  ]
},
  


  {
    name: "Sheet Collation Machine",
    image: mechineSheetCollationMachine,
    desc: "The Sheet Collation Machine is an advanced automation system designed for accurate sheet sequencing, alignment, and collection in smart card, RFID, secure document, and card manufacturing industries. The machine automatically gathers sheets from multiple stations, verifies sequence accuracy, and stacks them in the correct order for downstream production processes. With high-speed operation and sensor-based inspection, it minimizes manual handling, improves production efficiency, and ensures consistent product quality.",
    features: [
      "Automatic Sheet Feeding",
      "High-Speed Collation",
      "Accurate Sheet Alignment",
      "Multi-Station Collection",
      "Sensor-Based Verification",
      "Quality Assurance",
      "Reduced Manual Handling",
      "Industrial Grade Design",
    ],
  }, {
    name: "Card Laser Marker",
    image: mechineCardLaserMechine,
    desc: "The Card Laser Marker is a high-performance personalization and marking system designed for smart cards, RFID cards, banking cards, government ID cards, and access control cards. The machine integrates contact and contactless card reading, RFID mapping, high-speed laser marking, and automated verification to ensure accurate card personalization and traceability. Equipped with a 20W laser marking system and automatic rejection mechanism, it delivers precise marking, reliable data encoding validation, and consistent production quality for high-volume card manufacturing environments.",
    features: [
      "Feeder Magazine Capacity - 500 Cards",
      "Output Magazine Capacity - 500 Cards",
      "Automatic Rejection Box",
      "Up to 2500 Cards Per Hour",
      "Read Marking & Data Marking with Log"
    ],

  },
  {
    name: "Module Pushpull Tester",
    image: mechineModulePushpullTester,
    desc: "The Module Push-Pull Tester is a precision quality assurance system designed to evaluate the mechanical bonding strength and durability of smart card modules. The machine accurately measures the push and pull forces applied to embedded chip modules, ensuring compliance with international smart card manufacturing standards. In addition to force testing, the system supports pocket milling, window milling, and slot milling operations, making it an ideal solution for card manufacturing, testing laboratories, and quality control environments. Its advanced testing technology helps manufacturers verify module adhesion quality, reduce product failures, and ensure long-term card reliability",
    features: [
      "Accurate Force Testing",
      
      "Window Milling",
      "Slot Milling",
      "Push-Pull Force Measurement",
      "Quality Assurance & Validation"
    ]
  },
  {
    name: "Manual ATR Tester",
    image: mechineManualAtr,
    desc: "The Manual ATR Tester is a precision smart card testing system designed to verify the Answer To Reset (ATR) response of contact smart cards with exceptional accuracy and reliability. The machine enables operators to manually test single-chip, half-chip, and quarter-chip cards, ensuring proper chip functionality, communication integrity, and compliance with smart card standards. Built for quality control laboratories, card manufacturing facilities, and personalization centers, the Manual ATR Tester provides fast and dependable ATR validation, helping manufacturers identify defective cards before production and delivery.",
    features: [
      "Easy Operation",
      "Precision Engineered Design",
      "High Accuracy ATR Testing",
     
      "Single Chip Card Testing",
      "Half Chip Card Testing",
      "Quarter Chip Card Testing",
  
    
      
    ],

  },
  {
    name: "Manual Milling Machine with Imada",
    image: mechineManualImada,
    desc: "The Manual Milling Machine with Imada is a specialized smart card manufacturing and quality testing solution designed for precision pocket milling, module push-pull testing, and force verification applications. Equipped with an integrated Imada Force Gauge, the machine enables accurate measurement of module bonding strength and insertion force, ensuring compliance with smart card industry quality standards. Its robust construction and precision-engineered design make it ideal for smart card manufacturers, quality control laboratories, and R&D facilities requiring reliable milling and force testing capabilities.",
    features: [
      "Imada Force Gauge Integration",
      "Manual Pocket Milling",
      "Module Push-Pull Testing",
      "High Accuracy Measurement",
      "Smart Card Quality Testing",
      "RFID Card Support",
      "Reliable Force Verification",
      "Industrial Grade Construction",
    ],
  },
 {
  name: "Label Applicator Machine",
  image: labelApplicatorMachine,
  desc: "Automatic Label Applicator Machine designed for precise, high-speed labeling of smart cards and industrial products. It ensures accurate label placement, reduces manual effort, and improves production efficiency.",
  features: [
    "High-Speed Labeling",
    "Precision Placement",
    "PLC Control",
    "Touch Screen HMI",
    "Easy Operation",
    "Low Maintenance"
  ]
},
  {
  name: "Dual Head Card Punching Machine",
  image: dualHeadCardPunchingMachine,
  desc: "High-speed automatic card punching machine equipped with dual punching heads for simultaneous processing of PVC and smart cards. It delivers precise punching, improved productivity, and consistent quality for high-volume card manufacturing.",
  features: [
    "Dual Punching Heads",
    "High-Speed Operation",
    "Precision Punching",
    "PLC & HMI Control",
    "Servo Driven System",
    "Heavy-Duty Construction"
  ]
},
{
    name: "Torsion Tester",
    image: mechineTorsionTester,
    desc: "The Torsion Tester is a high-precision quality testing system designed to evaluate the torsional strength, flexibility, and durability of smart cards, RFID cards, banking cards, SIM cards, and other plastic card products. The machine applies controlled twisting forces to simulate real-world mechanical stress, ensuring cards maintain structural integrity and functionality throughout their lifecycle. It is an essential solution for manufacturers seeking to meet international quality standards and deliver reliable, long-lasting card products.",
    features: [
      "Precision Torsion Testing",
      "Adjustable Twist Angle",
      "Smart Card Durability Testing",
      "RFID Card Quality Verification",

    ],
  },

  {
  name: "Three Card Punching Machine",
  image: "/machines/three-card-punching-machine.webp",
  desc: "Automatic Three Card Punching Machine engineered to punch three PVC or smart cards simultaneously in a single cycle. It offers high-speed production, precise punching, and reliable performance for large-scale card manufacturing.",
  features: [
    "Three Card Simultaneous Punching",
    "High-Speed Operation",
    "Precision Punching",
    "PLC & HMI Control",
    "Servo Motor Driven",
    "Heavy-Duty Construction"
  ]
}, {
  name: "Laser Fume Extractor",
  image: laserFumeExtractor,
  desc: "High-performance Laser Fume Extractor designed to remove smoke, dust, and hazardous fumes generated during laser marking, engraving, and cutting processes. It features multi-stage filtration for a cleaner, safer, and more efficient working environment.",
  features: [
    "HEPA Filtration",
    "Activated Carbon Filter",
    "High Suction Power",
    "Low Noise Operation",
    "Portable Design",
    "Easy Maintenance"
  ]
},
  {
  name: "Milling Dust Collector",
  image: "/machines/milling-dust-collector.webp",
  desc: "High-efficiency Milling Dust Collector designed to capture fine dust and debris generated during card milling and precision machining. It ensures a clean workspace, protects equipment, and improves production quality with reliable dust extraction.",
  features: [
    "High Suction Power",
    "Multi-Stage Filtration",
    "Low Noise Operation",
    "Compact Design",
    "Continuous Dust Collection",
    "Easy Maintenance"
  ]
},
  {
  name: "PC-Based Online ATR Tester",
  image: pc_based_atr,
  desc: "Advanced PC-Based Online ATR Tester designed for automatic Answer to Reset (ATR) validation of contact smart cards. It provides real-time testing, pass/fail detection, data logging, and seamless integration with industrial production lines for reliable quality control.",
  features: [
    "Real-Time ATR Validation",
    "PC-Based Software",
    "Automatic Pass/Fail Detection",
    "PLC Integration",
    "Data Logging & Reports",
    "High-Speed Testing"
  ]
},  

];

export default machines;
