// Six public examples, separate from private scored question IDs.
export const ARCADE_DEMO=[
  {
    "id": "public-demo-1",
    "category": "administracion",
    "difficulty": 1,
    "scope": "CH",
    "canton": null,
    "status": "published",
    "language": "es",
    "prompt": "Acabas de llegar a vivir a Suiza. ¿Dónde te das de alta con tu pasaporte y tu contrato para tramitar tu permiso de residencia?",
    "options": [
      "En la Gemeinde donde vives, en la oficina de habitantes",
      "En la Post",
      "En tu Krankenkasse",
      "En el consulado de tu país"
    ],
    "correct_index": 0,
    "explanation": "Al llegar te das de alta en la Einwohnerkontrolle de tu Gemeinde, normalmente en los primeros 14 días. Desde allí se tramita tu permiso de residencia con la oficina cantonal de migración.",
    "source_url": "https://www.ch.ch/en/foreign-nationals-in-switzerland/living-in-switzerland/moving-to-switzerland/",
    "source_title": "ch.ch · Mudarse a Suiza",
    "reviewed_at": "2026-11-13",
    "game_type": "choice",
    "game_only": true
  },
  {
    "id": "public-demo-2",
    "category": "sociedad",
    "difficulty": 1,
    "scope": "CH",
    "canton": null,
    "status": "published",
    "language": "es",
    "prompt": "En la mayoría de municipios, la basura de casa se tira en bolsas oficiales de pago o con una etiqueta.",
    "options": [
      "Verdadero",
      "Falso"
    ],
    "correct_index": 0,
    "explanation": "Casi todos los municipios cobran la basura por bolsa: usas la bolsa oficial (Gebührensack) o pegas la etiqueta de tu municipio. Lo reciclable va aparte y suele ser gratis.",
    "source_url": "https://www.ch.ch/en/foreign-nationals-in-switzerland/living-in-switzerland/moving-to-switzerland/",
    "source_title": "Web de tu municipio",
    "reviewed_at": "2026-11-13",
    "game_type": "tf",
    "game_only": true
  },
  {
    "id": "public-demo-3",
    "category": "sociedad",
    "difficulty": 1,
    "scope": "CH",
    "canton": null,
    "status": "published",
    "language": "es",
    "prompt": "¿Cuáles son lenguas nacionales de Suiza?",
    "options": [
      "Alemán",
      "Francés",
      "Inglés",
      "Romanche",
      "Italiano"
    ],
    "correct_index": 0,
    "explanation": "Suiza tiene cuatro lenguas nacionales: alemán, francés, italiano y romanche. El inglés se usa mucho, pero no es lengua nacional.",
    "source_url": "https://www.eda.admin.ch/aboutswitzerland/en/home/gesellschaft/sprachen.html",
    "source_title": "admin.ch · Lenguas nacionales",
    "reviewed_at": "2026-11-13",
    "game_type": "multi",
    "game_only": true,
    "correct_indices": [
      0,
      1,
      3,
      4
    ]
  },
  {
    "id": "public-demo-4",
    "category": "salud",
    "difficulty": 1,
    "scope": "CH",
    "canton": null,
    "status": "published",
    "language": "es",
    "prompt": "Une cada número con su servicio de emergencia.",
    "options": [
      "117",
      "118",
      "144",
      "1414"
    ],
    "correct_index": 0,
    "explanation": "117 policía, 118 bomberos, 144 ambulancia y 1414 Rega, el rescate en helicóptero. El 112 funciona desde cualquier móvil.",
    "source_url": "https://www.ch.ch/en/safety-and-justice/emergencies-and-danger/",
    "source_title": "ch.ch · Números de emergencia",
    "reviewed_at": "2026-11-13",
    "game_type": "match",
    "game_only": true,
    "pairs": [
      "Policía",
      "Bomberos",
      "Ambulancia",
      "Rega, rescate aéreo"
    ]
  },
  {
    "id": "public-demo-5",
    "category": "sociedad",
    "difficulty": 1,
    "scope": "CH",
    "canton": null,
    "status": "published",
    "language": "es",
    "prompt": "¿Dónde se recicla esta botella de PET de bebida?",
    "options": [
      "En un punto de recogida de PET, como los de los supermercados",
      "En la bolsa de basura oficial",
      "En el contenedor de vidrio",
      "En la recogida de papel y cartón"
    ],
    "correct_index": 0,
    "explanation": "Las botellas de PET de bebida se devuelven en los puntos de recogida de PET, que hay en supermercados y estaciones. No van en la bolsa de basura ni en el vidrio.",
    "source_url": "https://petrecycling.ch/en/knowledge/",
    "source_title": "PET-Recycling Schweiz",
    "reviewed_at": "2026-11-13",
    "game_type": "image",
    "game_only": true,
    "image_key": "pet"
  },
  {
    "id": "public-demo-6",
    "category": "sociedad",
    "difficulty": 1,
    "scope": "CH",
    "canton": null,
    "status": "published",
    "language": "es",
    "prompt": "¿Cuál de estas afirmaciones es falsa?",
    "options": [
      "Suiza tiene 26 cantones",
      "Berna es la ciudad federal",
      "Suiza tiene cuatro lenguas nacionales",
      "Suiza es miembro de la Unión Europea"
    ],
    "correct_index": 3,
    "explanation": "Suiza no es miembro de la Unión Europea: se relaciona con ella mediante acuerdos bilaterales. Las otras tres afirmaciones son ciertas.",
    "source_url": "https://www.eda.admin.ch/aboutswitzerland/en/home/politik/uebersicht.html",
    "source_title": "admin.ch · Suiza y la UE",
    "reviewed_at": "2026-11-13",
    "game_type": "false",
    "game_only": true
  }
]
