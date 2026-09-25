import {csvExport} from './core.js';
const enc=new TextEncoder();
const xml=v=>String(v??'').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g,'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
function crc(bytes){let c=0xffffffff;for(const b of bytes){c^=b;for(let k=0;k<8;k++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;}
const le=(...fields)=>{const a=new Uint8Array(fields.reduce((n,[size])=>n+size,0)),v=new DataView(a.buffer);let p=0;for(const [size,n]of fields){size===2?v.setUint16(p,n,true):v.setUint32(p,n,true);p+=size;}return a;};
const join=parts=>{const a=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let o=0;for(const p of parts){a.set(p,o);o+=p.length;}return a;};
// ZIP STORE (sem compressão), suficiente para OOXML e sem dependência remota.
function zip(files){const local=[],central=[];let offset=0;for(const [name,text]of Object.entries(files)){
 const n=enc.encode(name),d=enc.encode(text),c=crc(d);
 const h=le([4,0x04034b50],[2,20],[2,0x800],[2,0],[2,0],[2,33],[4,c],[4,d.length],[4,d.length],[2,n.length],[2,0]);
 local.push(h,n,d);
 central.push(le([4,0x02014b50],[2,20],[2,20],[2,0x800],[2,0],[2,0],[2,33],[4,c],[4,d.length],[4,d.length],[2,n.length],[2,0],[2,0],[2,0],[2,0],[4,0],[4,offset]),n);
 offset+=h.length+n.length+d.length;
 }const directory=join(central),count=Object.keys(files).length;
 return join([...local,directory,le([4,0x06054b50],[2,0],[2,0],[2,count],[2,count],[4,directory.length],[4,offset],[2,0])]);}
const col=n=>{let s='';for(n++;n;n=Math.floor((n-1)/26))s=String.fromCharCode(65+(n-1)%26)+s;return s;};
export function xlsxBytes(rows){
 if(!rows.length||rows.length>1048576)throw Error('Quantidade de linhas inválida para XLSX.');
 const width=rows.reduce((n,r)=>Math.max(n,r.length),0);if(width<1||width>16384)throw Error('Quantidade de colunas inválida.');
 const end=col(width-1)+rows.length,ns='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
 const sheet=`<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="${ns}"><dimension ref="A1:${end}"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${Array.from({length:width},(_,i)=>`<col min="${i+1}" max="${i+1}" width="${i===0?28:32}" customWidth="1"/>`).join('')}</cols><sheetData>${rows.map((r,i)=>`<row r="${i+1}">${r.map((v,j)=>`<c r="${col(j)}${i+1}" t="inlineStr" s="${i===0?1:0}"><is><t xml:space="preserve">${xml(String(v??'').slice(0,32767))}</t></is></c>`).join('')}</row>`).join('')}</sheetData><autoFilter ref="A1:${end}"/></worksheet>`;
 return zip({
 '[Content_Types].xml':'<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>',
 '_rels/.rels':'<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
 'xl/workbook.xml':`<?xml version="1.0"?><workbook xmlns="${ns}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Dados" sheetId="1" r:id="rId1"/></sheets></workbook>`,
 'xl/_rels/workbook.xml.rels':'<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
 'xl/styles.xml':`<?xml version="1.0"?><styleSheet xmlns="${ns}"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF086E59"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="49" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="49" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`,
 'xl/worksheets/sheet1.xml':sheet});
}
export function exportRows(name,rows,format){
 const data=format==='xlsx'?xlsxBytes(rows):csvExport(rows),mime=format==='xlsx'?'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':'text/csv;charset=utf-8';
 const url=URL.createObjectURL(new Blob([data],{type:mime})),a=document.createElement('a');a.href=url;a.download=`${name.replace(/[^\p{L}\p{N}_-]/gu,'_')}.${format}`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);
}
