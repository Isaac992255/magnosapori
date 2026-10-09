// ==================== MENÚ TV CAFETERÍA — VALORES POR DEFECTO ====================
// Contenido inicial del menú. Se usa para sembrar el documento tvMenus/cafeteria
// en Firestore la primera vez, y como respaldo campo por campo si falta algo.
// Las ranuras son fijas: cada id corresponde a una fila del lienzo (index.html).

window.MENU_CAFETERIA_DEFAULT = {
  id: 'cafeteria',
  sections: [
    {
      id: 'variantes',
      items: [
        { id: 'americano', name: 'AMERICANO', prices: [5000, 5000, 5000] },
        { id: 'latte', name: 'LATTE', prices: [5000, 5000, 5000] },
        { id: 'flat-white', name: 'FLAT WHITE', prices: [5000] },
      ],
    },
    {
      id: 'clasica',
      items: [
        { id: 'cappuccino', name: 'CAPPUCCINO', subtitle: '', price: 15000 },
        { id: 'cappuccino-italiano', name: 'CAPPUCCINO ITALIANO', subtitle: '', price: 1000 },
        { id: 'cafe-saborizado', name: 'CAFÉ SABORIZADO', subtitle: 'Toffee, Vainilla o Almendras', price: 1500 },
        { id: 'cafe-frio', name: 'CAFÉ FRÍO', subtitle: 'Esto sería editable', price: 1000 },
      ],
    },
    {
      id: 'bebidas',
      items: [
        { id: 'smoothies', name: 'SMOOTHIES FRUTALES', price: 22000 },
        { id: 'limonada', name: 'LIMONADA', price: 18000 },
        { id: 'yogurth', name: 'YOGURTH CON FRUTAS', price: 22000 },
        { id: 'ensalada-frutas', name: 'ENSALADA DE FRUTAS', price: 22000 },
      ],
    },
  ],
};
