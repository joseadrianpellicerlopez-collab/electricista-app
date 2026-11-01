import { calcular, decimal, euros, paginar, partirTexto, validarPresupuesto } from './presupuestos';

const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

async function recurso(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error('No se ha podido cargar la plantilla. Comprueba la conexión.');
  return new Uint8Array(await response.arrayBuffer());
}

function xml(bytes, decode) {
  const doc = new DOMParser().parseFromString(decode(bytes), 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) throw new Error('La plantilla no es válida.');
  return doc;
}

export async function crearExcel(draft, template) {
  const { unzipSync, zipSync, strFromU8, strToU8 } = await import('fflate');
  const archivos = unzipSync(template || await recurso('/presupuestos/plantilla.xlsx'));
  const original = archivos['xl/worksheets/sheet1.xml'];
  const libro = xml(archivos['xl/workbook.xml'], strFromU8);
  const relaciones = xml(archivos['xl/_rels/workbook.xml.rels'], strFromU8);
  const tipos = xml(archivos['[Content_Types].xml'], strFromU8);
  const paginas = paginar(draft.lineas);
  const totales = calcular(draft.lineas, Number(draft.iva));
  const serializar = doc => strToU8(new XMLSerializer().serializeToString(doc));
  const estilos = xml(archivos['xl/styles.xml'], strFromU8);
  const formatos = estilos.getElementsByTagNameNS(NS, 'cellXfs')[0];
  const wrapped = new Map();
  function estiloEnvuelto(index) {
    if (wrapped.has(index)) return wrapped.get(index);
    const formato = formatos.children[Number(index) || 0].cloneNode(true);
    let alineacion = formato.getElementsByTagNameNS(NS, 'alignment')[0];
    if (!alineacion) { alineacion = estilos.createElementNS(NS, 'alignment'); formato.append(alineacion); }
    alineacion.setAttribute('wrapText', '1'); alineacion.setAttribute('vertical', 'top');
    const id = formatos.children.length;
    formatos.append(formato); formatos.setAttribute('count', String(id + 1)); wrapped.set(index, id);
    return id;
  }
  function tipo(partName, contentType) {
    const node = tipos.createElementNS(tipos.documentElement.namespaceURI, 'Override');
    node.setAttribute('PartName', partName); node.setAttribute('ContentType', contentType); tipos.documentElement.append(node);
  }
  const nombres = libro.getElementsByTagNameNS(NS, 'definedNames')[0];
  const lista = libro.getElementsByTagNameNS(NS, 'sheets')[0];
  lista.children[0].setAttribute('name', 'Presupuesto 1');
  while (nombres.firstChild) nombres.removeChild(nombres.firstChild);
  const sumas = [];

  paginas.forEach((lineas, index) => {
    const numero = index + 1;
    const hoja = xml(original, strFromU8);
    const filas = hoja.getElementsByTagNameNS(NS, 'sheetData')[0];
    function celda(ref, value, formula, wrap = false) {
      const row = Number(ref.match(/\d+/)[0]);
      let fila = [...filas.children].find(r => Number(r.getAttribute('r')) === row);
      if (!fila) { fila = hoja.createElementNS(NS, 'row'); fila.setAttribute('r', String(row)); filas.append(fila); }
      let c = [...fila.children].find(n => n.getAttribute('r') === ref);
      if (!c) {
        c = hoja.createElementNS(NS, 'c'); c.setAttribute('r', ref);
        const col = ref.replace(/\d/g, '');
        const siguiente = [...fila.children].find(n => n.getAttribute('r').replace(/\d/g, '') > col);
        fila.insertBefore(c, siguiente || null);
      }
      const estilo = c.getAttribute('s') || '0';
      while (c.firstChild) c.removeChild(c.firstChild);
      c.removeAttribute('t');
      if (formula) { const f = hoja.createElementNS(NS, 'f'); f.textContent = formula; c.append(f); }
      if (typeof value === 'number' || formula) {
        const v = hoja.createElementNS(NS, 'v'); v.textContent = String(value); c.append(v);
      } else {
        c.setAttribute('t', 'inlineStr'); const is = hoja.createElementNS(NS, 'is'), t = hoja.createElementNS(NS, 't');
        t.setAttributeNS('http://www.w3.org/XML/1998/namespace', 'xml:space', 'preserve'); t.textContent = value || ''; is.append(t); c.append(is);
      }
      if (wrap) c.setAttribute('s', String(estiloEnvuelto(estilo)));
      return c;
    }
    const merges = hoja.getElementsByTagNameNS(NS, 'mergeCells')[0];
    function fusionar(ref) {
      if ([...merges.children].some(m => m.getAttribute('ref') === ref)) return;
      const merge = hoja.createElementNS(NS, 'mergeCell'); merge.setAttribute('ref', ref); merges.append(merge);
    }
    celda('I3', draft.numero); celda('I4', draft.fecha.split('-').reverse().join('/'));
    celda('I6', `Página ${numero} de ${paginas.length}`);
    fusionar('G9:H9'); fusionar('G10:H10'); fusionar('G11:H11'); fusionar('G12:H12');
    celda('G9', draft.cliente, null, true); celda('G10', draft.direccion, null, true);
    celda('G11', draft.nif ? `NIF/CIF: ${draft.nif}` : ''); celda('G12', draft.contacto, null, true);
    celda('F14', 'Ud.'); celda('I14', 'PRECIO UNIDAD');
    const ocupado = lineas.reduce((suma, l) => suma + Math.max(15, partirTexto(l.nombre).length * 12), 0);
    const vacio = lineas.length < 25 ? Math.max(4, (375 - ocupado) / (25 - lineas.length)) : 15;
    for (let n = 15; n <= 39; n++) {
      const linea = lineas[n - 15]; fusionar(`G${n}:H${n}`);
      celda(`F${n}`, linea ? decimal(linea.cantidad) : '');
      celda(`G${n}`, linea?.nombre || '', null, true);
      celda(`I${n}`, linea ? linea.precio / 100 : '');
      celda(`J${n}`, linea ? Math.round(decimal(linea.cantidad) * linea.precio) / 100 : 0, `ROUND(F${n}*I${n},2)`);
      const fila = [...filas.children].find(r => Number(r.getAttribute('r')) === n);
      fila.setAttribute('ht', String(linea ? Math.max(15, partirTexto(linea.nombre).length * 12) : vacio)); fila.setAttribute('customHeight', '1');
    }
    const notas = partirTexto(draft.observaciones.replace(/\s+/g, ' '), 88);
    // Keep all observations in one wrapped block instead of losing excess lines.
    for (const merge of [...merges.children]) if (/^F4[1-5]:I4[1-5]$/.test(merge.getAttribute('ref'))) merge.remove();
    fusionar('F41:I45'); celda('F41', notas.join('\n'), null, true);
    for (let n = 42; n <= 45; n++) celda(`F${n}`, '');
    const subtotal = calcular(lineas, 0).base;
    sumas.push(`'Presupuesto ${numero}'!J46`);
    const ultima = numero === paginas.length;
    celda('I46', ultima && paginas.length > 1 ? 'BASE TOTAL' : 'BASE IMPONIBLE');
    const baseFormula = ultima && paginas.length > 1 ? `${sumas.slice(0, -1).join('+')}+SUM(J15:J39)` : 'SUM(J15:J39)';
    celda('J46', (ultima ? totales.base : subtotal) / 100, baseFormula);
    celda('I47', Number(draft.iva)); celda('I47', Number(draft.iva)).removeAttribute('s');
    celda('J47', Math.round((ultima ? totales.base : subtotal) * Number(draft.iva) / 100) / 100, 'ROUND(J46*I47/100,2)');
    fusionar('F48:I48'); celda('F48', draft.pago, null, true); celda('J48', '');
    celda('I49', ultima ? 'TOTAL' : 'SUBTOTAL PÁGINA');
    celda('J49', (ultima ? totales.total : subtotal + Math.round(subtotal * Number(draft.iva) / 100)) / 100, 'J46+J47');
    merges.setAttribute('count', String(merges.children.length));
    const setup = hoja.getElementsByTagNameNS(NS, 'pageSetup')[0]; setup.setAttribute('fitToWidth', '1'); setup.setAttribute('fitToHeight', '1');
    const props = hoja.getElementsByTagNameNS(NS, 'sheetPr')[0] || hoja.documentElement.insertBefore(hoja.createElementNS(NS, 'sheetPr'), hoja.documentElement.firstChild);
    let pageProps = props.getElementsByTagNameNS(NS, 'pageSetUpPr')[0];
    if (!pageProps) { pageProps = hoja.createElementNS(NS, 'pageSetUpPr'); props.append(pageProps); }
    pageProps.setAttribute('fitToPage', '1');
    archivos[`xl/worksheets/sheet${numero}.xml`] = serializar(hoja);
    if (numero > 1) {
      const id = `rIdBudget${numero}`;
      const sheet = libro.createElementNS(NS, 'sheet'); sheet.setAttribute('name', `Presupuesto ${numero}`); sheet.setAttribute('sheetId', String(numero)); sheet.setAttributeNS(REL, 'r:id', id); lista.append(sheet);
      const relation = relaciones.createElementNS(relaciones.documentElement.namespaceURI, 'Relationship'); relation.setAttribute('Id', id); relation.setAttribute('Type', `${REL}/worksheet`); relation.setAttribute('Target', `worksheets/sheet${numero}.xml`); relaciones.documentElement.append(relation);
      tipo(`/xl/worksheets/sheet${numero}.xml`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml');
      const rels = strFromU8(archivos['xl/worksheets/_rels/sheet1.xml.rels']).replace('drawing1.xml', `drawing${numero}.xml`);
      archivos[`xl/worksheets/_rels/sheet${numero}.xml.rels`] = strToU8(rels);
      archivos[`xl/drawings/drawing${numero}.xml`] = archivos['xl/drawings/drawing1.xml'];
      archivos[`xl/drawings/_rels/drawing${numero}.xml.rels`] = archivos['xl/drawings/_rels/drawing1.xml.rels'];
      tipo(`/xl/drawings/drawing${numero}.xml`, 'application/vnd.openxmlformats-officedocument.drawing+xml');
    }
    const area = libro.createElementNS(NS, 'definedName'); area.setAttribute('name', '_xlnm.Print_Area'); area.setAttribute('localSheetId', String(index)); area.textContent = `'Presupuesto ${numero}'!$A$1:$K$51`; nombres.append(area);
  });
  const calc = libro.getElementsByTagNameNS(NS, 'calcPr')[0]; calc.setAttribute('fullCalcOnLoad', '1');
  archivos['xl/styles.xml'] = serializar(estilos); archivos['xl/workbook.xml'] = serializar(libro); archivos['xl/_rels/workbook.xml.rels'] = serializar(relaciones); archivos['[Content_Types].xml'] = serializar(tipos);
  delete archivos['xl/calcChain.xml'];
  for (const rel of [...relaciones.documentElement.children]) if (rel.getAttribute('Type')?.endsWith('/calcChain')) rel.remove();
  archivos['xl/_rels/workbook.xml.rels'] = serializar(relaciones);
  return new Blob([zipSync(archivos)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export async function crearPDF(draft, logoBytes) {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica), bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const logo = await doc.embedPng(logoBytes || await recurso('/presupuestos/logo.png'));
  const azul = rgb(0.12, 0.3, 0.45), claro = rgb(0.87, 0.92, 0.96), blanco = rgb(1, 1, 1), negro = rgb(0.15, 0.18, 0.22);
  const paginas = paginar(draft.lineas), total = calcular(draft.lineas, Number(draft.iva));
  // Standard fonts support Spanish text. Unsupported glyphs are replaced, never crash the export.
  const clean = text => [...String(text ?? '')].map(c => { try { font.encodeText(c); return c; } catch { return '?'; } }).join('');
  for (const [index, lineas] of paginas.entries()) {
    const page = doc.addPage([595.28, 841.89]);
    const text = (value, x, y, size = 10, weight = false, color = negro) => page.drawText(clean(value), { x, y, size, font: weight ? bold : font, color });
    const rect = (x, y, width, height, color) => page.drawRectangle({ x, y, width, height, color });
    const right = (value, x, y, size = 10, weight = false, color = negro) => text(value, x - (weight ? bold : font).widthOfTextAtSize(clean(value), size), y, size, weight, color);
    rect(362, 711, 205, 103, azul);
    text('José Adrián Pellicer López', 29, 792, 20, true);
    page.drawImage(logo, { x: 30, y: 713, width: 100, height: 67 });
    text('648 78 06 82', 143, 746, 11);
    text('electroclimajoseadrian@gmail.com', 143, 730, 9);
    text('PRESUPUESTO', 373, 790, 19, true, blanco);
    text(draft.numero, 373, 767, 10, false, blanco);
    text(draft.fecha.split('-').reverse().join('/'), 373, 749, 10, false, blanco);
    text(`Página ${index + 1} de ${paginas.length}`, 373, 728, 9, false, blanco);
    rect(28, 679, 539, 21, azul); text('DATOS CLIENTE', 40, 685, 11, true, blanco);
    let y = 662;
    for (const value of [draft.cliente, draft.direccion, draft.nif ? `NIF/CIF: ${draft.nif}` : '', draft.contacto].filter(Boolean)) {
      for (const line of partirTexto(value, 90)) { text(line, 40, y, 10); y -= 12; }
    }
    rect(28, 570, 539, 22, azul); text('UD.', 34, 577, 9, true, blanco); text('DESCRIPCIÓN', 69, 577, 10, true, blanco); right('PRECIO UNIDAD', 477, 577, 9, true, blanco); right('TOTAL', 560, 577, 10, true, blanco);
    y = 570;
    for (const [n, linea] of lineas.entries()) {
      const descripcion = partirTexto(linea.nombre), alto = Math.max(15, descripcion.length * 12 + 3);
      if (n % 2 === 0) rect(28, y - alto, 539, alto, claro);
      text(linea.cantidad, 34, y - 12, 9);
      descripcion.forEach((line, i) => text(line, 69, y - 12 - i * 12, 9));
      right(euros(linea.precio), 477, y - 12, 9);
      right(euros(Math.round(linea.precio * decimal(linea.cantidad))), 560, y - 12, 9);
      y -= alto;
    }
    const notesTop = Math.min(y - 22, 155);
    rect(28, notesTop, 539, 20, azul); text('Observaciones', 34, notesTop + 6, 10, false, blanco);
    let notaY = notesTop - 13;
    for (const line of partirTexto(draft.observaciones.replace(/\s+/g, ' '), 110)) { text(line, 34, notaY, 8); notaY -= 10; }
    const ultima = index === paginas.length - 1;
    const sumas = ultima ? total : calcular(lineas, Number(draft.iva));
    rect(362, 77, 205, 19, azul); text(ultima ? 'BASE IMPONIBLE' : 'BASE PÁGINA', 370, 83, 9, false, blanco); right(euros(sumas.base), 560, 83, 10, true, blanco);
    rect(362, 57, 205, 19, claro); text(`IVA ${draft.iva} %`, 370, 63, 9); right(euros(sumas.impuesto), 560, 63, 10);
    rect(362, 32, 205, 21, azul); text(ultima ? 'TOTAL' : 'SUBTOTAL PÁGINA', 370, 39, 10, true, blanco); right(euros(sumas.total), 560, 39, 11, true, blanco);
    text('Datos para el pago', 34, 82, 9, true);
    partirTexto(draft.pago.replace(/\s+/g, ' '), 52).forEach((line, i) => text(line, 34, 68 - i * 10, 8));
  }
  doc.setTitle(`Presupuesto ${draft.numero}`); doc.setAuthor('José Adrián Pellicer López');
  return new Blob([await doc.save()], { type: 'application/pdf' });
}

export async function generarArchivos(draft) {
  const error = validarPresupuesto(draft);
  if (error) throw new Error(error);
  const [excel, pdf] = await Promise.all([crearExcel(draft), crearPDF(draft)]);
  return { excel, pdf };
}
