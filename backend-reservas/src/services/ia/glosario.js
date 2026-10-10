import { plegar } from "./texto.js";

/**
 * Glosario de respaldo (español → inglés / portugués) para cuando no hay IA ni traductor en línea.
 * Traduce frases y palabras comunes de una carta argentina; lo que no conoce lo deja como está.
 */
const FRASES = [
  ["bife de chorizo", "Sirloin steak", "Bife de chorizo (contrafilé)"],
  ["milanesa napolitana", "Breaded cutlet napolitana style", "Milanesa à napolitana"],
  ["empanadas de carne", "Beef empanadas", "Empanadas de carne"],
  ["provoleta a la parrilla", "Grilled provolone", "Provoleta grelhada"],
  ["tabla de fiambres", "Cold cuts board", "Tábua de frios"],
  ["ravioles de ricota", "Ricotta ravioli", "Ravióli de ricota"],
  ["risotto de hongos", "Mushroom risotto", "Risoto de cogumelos"],
  ["ensalada completa", "Full salad", "Salada completa"],
  ["agua mineral", "Mineral water", "Água mineral"],
  ["cerveza artesanal", "Craft beer", "Cerveja artesanal"],
  ["copa de", "Glass of", "Taça de"],
  ["limonada con menta", "Mint lemonade", "Limonada com hortelã"],
  ["flan casero", "Homemade flan", "Pudim caseiro"],
  ["brownie con helado", "Brownie with ice cream", "Brownie com sorvete"],
  ["dulce de leche", "dulce de leche", "doce de leite"],
  ["hojas verdes", "green leaves", "folhas verdes"],
  ["ají molido", "chili flakes", "pimenta calabresa"],
  ["jamón crudo", "cured ham", "presunto cru"],
  ["a elección", "of your choice", "à escolha"],
  ["selección de la casa", "House selection", "Seleção da casa"],
  ["con o sin gas", "Still or sparkling", "Com ou sem gás"],
  ["chocolate semiamargo", "Dark chocolate", "Chocolate meio amargo"],
  ["a la parrilla", "grilled", "grelhado"],
  ["al horno", "baked", "assado"],
  ["cortadas a cuchillo", "hand-cut", "cortadas na faca"],
  ["a cuchillo", "hand-cut", "na faca"],
];

const PALABRAS = {
  de: ["of", "de"], con: ["with", "com"], y: ["and", "e"], sin: ["without", "sem"], o: ["or", "ou"], a: ["to", "a"], al: ["to the", "ao"], la: ["the", "a"], el: ["the", "o"], los: ["the", "os"], las: ["the", "as"], en: ["in", "em"],
  carne: ["beef", "carne"], pollo: ["chicken", "frango"], pescado: ["fish", "peixe"], cerdo: ["pork", "porco"], queso: ["cheese", "queijo"], quesos: ["cheeses", "queijos"], jamón: ["ham", "presunto"], salame: ["salami", "salame"],
  papas: ["potatoes", "batatas"], fritas: ["fries", "fritas"], frito: ["fried", "frito"], ensalada: ["salad", "salada"], tomate: ["tomato", "tomate"], huevo: ["egg", "ovo"], atún: ["tuna", "atum"],
  salsa: ["sauce", "molho"], crema: ["cream", "creme"], manteca: ["butter", "manteiga"], hongos: ["mushrooms", "cogumelos"], orégano: ["oregano", "orégano"], parmesano: ["parmesan", "parmesão"],
  fileto: ["tomato sauce", "molho de tomate"], guarnición: ["side dish", "guarnição"], natural: ["natural", "natural"], jengibre: ["ginger", "gengibre"], menta: ["mint", "hortelã"],
  chocolate: ["chocolate", "chocolate"], vainilla: ["vanilla", "baunilha"], helado: ["ice cream", "sorvete"], casero: ["homemade", "caseiro"], casera: ["homemade", "caseira"],
  pinta: ["pint", "pint"], cortadas: ["cut", "cortadas"], horno: ["oven", "forno"], parrilla: ["grill", "grelha"], postre: ["dessert", "sobremesa"], postres: ["desserts", "sobremesas"],
  entradas: ["starters", "entradas"], principales: ["main courses", "pratos principais"], bebidas: ["drinks", "bebidas"], agua: ["water", "água"], vino: ["wine", "vinho"], tinto: ["red", "tinto"], blanco: ["white", "branco"],
  café: ["coffee", "café"], té: ["tea", "chá"], gaseosa: ["soda", "refrigerante"], jugo: ["juice", "suco"], limonada: ["lemonade", "limonada"], cerveza: ["beer", "cerveja"],
  pan: ["bread", "pão"], arroz: ["rice", "arroz"], verduras: ["vegetables", "legumes"], vegetales: ["vegetables", "vegetais"], pasta: ["pasta", "massa"], pastas: ["pasta", "massas"],
  picante: ["spicy", "picante"], suave: ["mild", "suave"], grande: ["large", "grande"], chico: ["small", "pequeno"], porción: ["portion", "porção"], porciones: ["portions", "porções"],
};

const mayuscula = (t, original) => (original && original[0] === original[0].toUpperCase() && t ? t[0].toUpperCase() + t.slice(1) : t);

export function traducirConGlosario(texto, idioma) {
  const col = idioma === "pt" ? 2 : 1;
  const colPalabra = idioma === "pt" ? 1 : 0;
  const trozos = String(texto).split(/(\s+)/);
  const salida = [];
  for (let i = 0; i < trozos.length; ) {
    if (/^\s+$/.test(trozos[i])) { salida.push(trozos[i]); i += 1; continue; }
    let hecho = false;
    // Frases de hasta 4 palabras, de la más larga a la más corta.
    for (let n = 4; n >= 2 && !hecho; n--) {
      const grupo = trozos.slice(i, i + n * 2 - 1);
      if (grupo.filter((t) => !/^\s+$/.test(t)).length < n) continue;
      const clave = plegar(grupo.join("").replace(/\s+/g, " ").replace(/[.,;:()]+$/g, ""));
      const frase = FRASES.find((f) => plegar(f[0]) === clave);
      if (frase) {
        const cola = /[^\p{L}\d]*$/u.exec(grupo[grupo.length - 1])?.[0] ?? "";
        salida.push(mayuscula(frase[col], grupo[0]) + cola);
        i += n * 2 - 1;
        hecho = true;
      }
    }
    if (hecho) continue;
    const m = /^([^\p{L}\d]*)([\p{L}\d]+)([^\p{L}\d]*)$/u.exec(trozos[i]);
    if (m) {
      const clave = Object.keys(PALABRAS).find((k) => plegar(k) === plegar(m[2]));
      salida.push(m[1] + (clave ? mayuscula(PALABRAS[clave][colPalabra], m[2]) : m[2]) + m[3]);
    } else salida.push(trozos[i]);
    i += 1;
  }
  return salida.join("").replace(/\s{2,}/g, " ").trim();
}
