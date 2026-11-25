'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {classify,regulatoryLinks}=require('./links.cjs');
test('documentos privados se abren sólo dentro del origen; fuentes externas son referencias literales confirmables',()=>{
  const origin='https://pld.empresa.test',pdf='https://www.diputados.gob.mx/LeyesBiblio/pdf/LFPIORPI.pdf';
  const links=regulatoryLinks(['url: "'+pdf+'"']);
  assert.equal(classify(pdf,origin,links),'external');
  assert.equal(classify(pdf+'?cliente=prueba',origin,links),null);
  assert.equal(classify(origin+'/api/v1/companies/A/files/B',origin,links),'document');
  assert.equal(classify(origin+'/api/v1/companies/A/files/B/restore',origin,links),null);
  assert.equal(classify('mailto:alicia@davara.com.mx?subject=Quiero%20adquirir%20Alicia',origin,links),'external');
  assert.equal(classify('mailto:alicia@davara.com.mx?body=datos',origin,links),null);
});
