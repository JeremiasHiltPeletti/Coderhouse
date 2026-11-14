/* Sunnygafas · prototipo navegable (etapas 1 a 3).
   Un solo script arma cada página según data-page del <body>. El carrito vive en localStorage y pasa entre páginas. */
(function(){
'use strict';
var IMG='assets/productos/';
var SPRITE='/*SPRITE*/';
document.body.insertAdjacentHTML('afterbegin','<svg width="0" height="0" style="position:absolute" aria-hidden="true">'+SPRITE+'</svg>');

/* ---------- utilidades ---------- */
function fmt(n){var neg=n<0;n=Math.abs(Math.round(n*100)/100);return (neg?'−':'')+'$'+n.toLocaleString('es-AR',{minimumFractionDigits:(n%1?2:0),maximumFractionDigits:2});}
function ico(id,cls){return '<svg class="ico'+(cls?' '+cls:'')+'" aria-hidden="true"><use href="#'+id+'"/></svg>';}
function $(sel,root){return (root||document).querySelector(sel);}
function $$(sel,root){return [].slice.call((root||document).querySelectorAll(sel));}
var mem={};
function load(k,d){try{var v=localStorage.getItem(k);return v?JSON.parse(v):d;}catch(e){return mem[k]||d;}}
function save(k,v){mem[k]=v;try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}}
var WA='#whatsapp';

/* ---------- catálogo real de la tienda actual ---------- */
var TORT='linear-gradient(135deg,#5A3618 0 30%,#B98552 30% 55%,#3A2414 55%)';
var HEX={Negro:'#1E1A16','Marrón':'#7A4A24',Carey:TORT,Print:TORT,Gris:'#A9A6A2',Verde:'#9DBB9E',Amarillo:'#E2B03A',Naranja:'#E58A2B',Azul:'#5D86A8',Caramelo:'#B8763A',Rosa:'#E7B8B2',Gold:'#C9A85C',Silver:'#C7C9CC',Rose:'#D8A79A',Beige:'#D9C4A3',Black:'#1E1A16'};
var COL={'Básica':27000,'Esencial':40000,'Superior':54000,'Élite':67000};
var COLSLUG={'basica':'Básica','esencial':'Esencial','superior':'Superior','elite':'Élite'};
var FULL=['aviador-pol-negro','braga-verde-2','charlotte-marron-2','charlotte-marron','charlotte-negro','dallas-negro','glow-negro-2','glow-negro-3','glow-negro-4','mery-azul-2','mery-azul','mery-violeta','molly-marron-2','molly-marron','molly-negro','pilot-negro-2','pilot-negro','roxy-gris-2','saturday-print-2','saturday-print','yanis-negro','yanis-print-2','cadena-beige','cadena-caramel','cadena-gold','cadena-rose','cadena-silver','cadena-black','cadena-gris'];
function fc(img){return FULL.indexOf(img)>-1?' full':'';}
var P=[
 {id:'glow',n:'Glow',cat:'sol',col:'Básica',shape:'redonda',vars:[{c:'Negro',img:'glow-negro',gal:['glow-negro','glow-negro-2','glow-negro-4']}],
  desc:'<p>Ovaladas y chicas, con aro dorado fino y lente negro. Tienen ese aire de los noventa que va con jean y remera o con un vestido de verano. Por su tamaño, quedan mejor en caras chicas o medianas y en rasgos marcados.</p><ul><li>Lente negro con filtro UV400.</li><li>Aro dorado y varillas negras: [material del marco a confirmar].</li><li>Colección Básica: $27.000 de lista.</li></ul>'},
 {id:'braga',n:'Braga',cat:'sol',col:'Básica',shape:'aviador',vars:[{c:'Verde',img:'braga-verde',gal:['braga-verde','braga-verde-2']},{c:'Amarillo',img:'braga-amarillo'}]},
 {id:'roxy',n:'Roxy',cat:'sol',col:'Básica',shape:'cateye',vars:[{c:'Gris',img:'roxy-gris',gal:['roxy-gris','roxy-gris-2']}],desc:'<p>Armazón de policarbonato gris traslúcido con cristales negros y filtro UV400.</p>'},
 {id:'dallas',n:'Dallas',cat:'sol',col:'Básica',shape:'cuadrada',vars:[{c:'Marrón',img:'dallas-marron',gal:['dallas-marron','dallas-marron-2']},{c:'Negro',img:'dallas-negro'}]},
 {id:'saturday',n:'Saturday XL',cat:'sol',col:'Básica',shape:'aviador',isNew:true,vars:[{c:'Naranja',label:'Naranja y azul',img:'saturday-azul'},{c:'Print',img:'saturday-print',gal:['saturday-print','saturday-print-2']}]},
 {id:'molly',n:'Molly',cat:'sol',col:'Esencial',shape:'redonda',vars:[{c:'Marrón',img:'molly-marron',gal:['molly-marron','molly-marron-2']},{c:'Negro',img:'molly-negro'}]},
 {id:'yanis',n:'Yanis',cat:'sol',col:'Esencial',shape:'cateye',vars:[{c:'Print',img:'yanis-print',gal:['yanis-print','yanis-print-2']},{c:'Negro',img:'yanis-negro'}]},
 {id:'gala',n:'Gala',cat:'sol',col:'Superior',shape:'ovalada',isNew:true,vars:[{c:'Carey',img:'gala-carey',gal:['gala-carey','gala-carey-2']},{c:'Negro',img:'gala-negro'},{c:'Caramelo',img:'gala-caramelo'},{c:'Print',img:'gala-print'}]},
 {id:'siena',n:'Siena',cat:'sol',col:'Superior',shape:'ovalada',extra:3,extraColors:['Negro','Carey','Print'],vars:[{c:'Marrón',img:'siena-marron',gal:['siena-marron','siena-marron-2']}]},
 {id:'charlotte',n:'Charlotte',cat:'sol',col:'Élite',shape:'cuadrada',isNew:true,vars:[{c:'Marrón',img:'charlotte-marron',gal:['charlotte-marron','charlotte-marron-2']},{c:'Negro',img:'charlotte-negro'}]},
 {id:'pilot',n:'Pilot',cat:'sol',col:'Élite',shape:'cateye',vars:[{c:'Negro',img:'pilot-negro-2',gal:['pilot-negro-2','pilot-negro']}],desc:'<p>Armazón de policarbonato negro con detalles plata en las varillas y cristales con filtro UV400.</p>'},
 {id:'tulum',n:'Tulum',cat:'pol',pol:true,list:80000,shape:'redonda',vars:[{c:'Azul',label:'Azul print',img:'tulum-pol'}]},
 {id:'aviador-pol',n:'Aviador polarizado',cat:'pol',pol:true,list:80000,shape:'aviador',extra:1,extraColors:['Marrón'],vars:[{c:'Negro',img:'aviador-pol-negro'}],desc:'<p>Armazón metálico negro mate con varillas de policarbonato, plaquetas de silicona y cristales negros polarizados.</p>'},
 {id:'oriana',n:'Oriana',cat:'arm',list:27000,shape:'cuadrada',vars:[{c:'Rosa',img:'oriana-rosa'},{c:'Negro',img:'oriana-negro'},{c:'Print',img:'oriana-print'}]},
 {id:'cadena-gold',n:'Cadena',cat:'acc',list:6000,vars:[{c:'Gold',img:'cadena-gold'}]},
 {id:'cadena-silver',n:'Cadena',cat:'acc',list:6000,vars:[{c:'Silver',img:'cadena-silver'}]},
 {id:'cadena-rose',n:'Cadena',cat:'acc',list:6000,vars:[{c:'Rose',img:'cadena-rose'}]},
 {id:'cadena-gris',n:'Cadena',cat:'acc',list:6000,vars:[{c:'Gris',img:'cadena-gris'}]},
 {id:'cadena-beige',n:'Cadena',cat:'acc',list:11200,vars:[{c:'Beige',img:'cadena-beige'}],desc:'<p>Cadena de acrílico beige y dorado.</p>'},
 {id:'cadena-caramel',n:'Cadena',cat:'acc',list:11200,vars:[{c:'Caramelo',label:'Caramel',img:'cadena-caramel'}]},
 {id:'cadena-black',n:'Cadena',cat:'acc',list:11200,vars:[{c:'Black',img:'cadena-black'}]}
];
P.forEach(function(p){p.list=p.list||COL[p.col];});
var BY={};P.forEach(function(p){BY[p.id]=p;});
var SHAPES={redonda:'Redondas',ovalada:'Ovaladas',cuadrada:'Cuadradas',cateye:'Cat eye',aviador:'Aviador'};
var SHAPE_ICO={redonda:'f-redonda',ovalada:'f-ovalada',cuadrada:'f-cuadrada',cateye:'f-cateye',aviador:'f-aviador'};
function typeLabel(p){return p.cat==='acc'?'Accesorio':p.cat==='arm'?'Armazón':p.pol?'Polarizada':'Colección '+p.col;}

/* ---------- carrito ---------- */
var cart=load('sg-cart',[]);
function cartCount(){return cart.reduce(function(a,i){return a+i.q;},0);}
function cartSub(){return cart.reduce(function(a,i){var p=BY[i.id];return a+(p?p.list*i.q:0);},0);}
function addToCart(id,vi){var f=cart.filter(function(x){return x.id===id&&x.v===vi;})[0];if(f)f.q++;else cart.push({id:id,v:vi,q:1});save('sg-cart',cart);refreshCount();}
function refreshCount(){$$('.hdr .count-wrap').forEach(function(w){var n=cartCount();w.innerHTML=n?'<span class="count">'+n+'</span>':'';w.parentNode.setAttribute('aria-label','Carrito, '+n+' productos');});}

/* ---------- precio y card ---------- */
function priceHTML(list,cls){var t=list*.75,q=list/3,tax=Math.round(list/1.21);
  return '<div class="price '+(cls||'')+'"><p class="p-transfer"><b>'+fmt(t)+'</b>con transferencia</p><p class="p-list">'+fmt(list)+' o 3 × '+fmt(q)+' sin interés</p><p class="p-tax">Precio sin imp. nacionales: '+fmt(tax)+'</p></div>';}
function purl(id,vi){return 'producto.html#'+id+(vi?'-'+vi:'');}
function cardHTML(p,o){
  o=o||{};var vi=0;
  if(o.color)p.vars.forEach(function(v,i){if(v.c===o.color&&!vi)vi=i;});
  var v=p.vars[vi],alt=(v.gal&&v.gal[1])||null,b='';
  if(p.isNew&&o.showNew)b+='<span class="badge b-new">Nuevo</span>';
  if(p.pol)b+='<span class="badge b-pol">Polarizada</span>';
  if(p.cat==='arm'&&o.showType)b+='<span class="badge b-type">Armazón</span>';
  var sw=p.vars.length>1||p.extra?p.vars.map(function(x,i){return '<button type="button" aria-pressed="'+(i===vi)+'" aria-label="'+(x.label||x.c)+'" data-i="'+i+'"><i style="background:'+HEX[x.c]+'"></i></button>';}).join('')+(p.extra?'<small>+'+p.extra+'</small>':''):'<span style="display:inline-flex;padding:6px"><i style="width:24px;height:24px;border-radius:50%;border:1px solid rgba(30,26,22,.18);background:'+HEX[v.c]+'"></i></span>';
  return '<div class="card" data-id="'+p.id+'"><a class="card-photo" href="'+purl(p.id,vi)+'" tabindex="-1" aria-hidden="true">'+(b?'<span class="badges">'+b+'</span>':'')+
   '<img class="main'+fc(v.img)+'" src="'+IMG+v.img+'.webp" alt="" loading="lazy">'+(alt?'<img class="alt full" src="'+IMG+alt+'.webp" alt="" loading="lazy">':'')+'</a>'+
   '<p class="card-name"><a href="'+purl(p.id,vi)+'">'+p.n+' <span>· '+(v.label||v.c)+'</span></a></p><div class="sw" role="group" aria-label="Colores de '+p.n+'">'+sw+'</div>'+priceHTML(p.list)+'</div>';
}
document.addEventListener('click',function(e){
  var b=e.target.closest('.card .sw button');if(!b)return;
  var card=b.closest('.card'),p=BY[card.dataset.id],i=+b.dataset.i,v=p.vars[i];
  $$('.sw button',card).forEach(function(x){x.setAttribute('aria-pressed',x===b);});
  var m=$('img.main',card);m.src=IMG+v.img+'.webp';m.className='main'+fc(v.img);
  var a=$('img.alt',card);if(a)a.remove();
  $('.card-name span',card).textContent='· '+(v.label||v.c);
  $$('a',card).forEach(function(x){x.href=purl(p.id,i);});
});
function raysSVG(n,w,h){var cx=w/2,cy=h-2,r0=h*.32,r1=h*.92,o='<svg class="rays" width="'+w+'" height="'+h+'" viewBox="0 0 '+w+' '+h+'" aria-hidden="true"><path d="M2 '+cy+'H'+(w-2)+'" stroke="currentColor" stroke-width="1.25"/>';
  for(var i=0;i<n;i++){var a=Math.PI*(.12+.76*(n===1?.5:i/(n-1))),l=(i%2?r1*.78:r1);o+='<line x1="'+(cx-Math.cos(a)*r0).toFixed(1)+'" y1="'+(cy-Math.sin(a)*r0).toFixed(1)+'" x2="'+(cx-Math.cos(a)*l).toFixed(1)+'" y2="'+(cy-Math.sin(a)*l).toFixed(1)+'" stroke="currentColor" stroke-width="1.25" stroke-linecap="round"/>';}
  return o+'</svg>';}

/* ---------- header, menú, footer ---------- */
function headerHTML(){
  return '<a class="skip" href="#contenido">Ir al contenido</a>'+
  '<div class="announce" role="region" aria-label="Beneficios"><span class="m-only ann-m">25% de descuento con transferencia</span><span class="d-only">25% de descuento con transferencia</span><span class="d-only sep">·</span><span class="d-only">3 cuotas sin interés</span><span class="d-only sep">·</span><span class="d-only">Despachamos todos los días hábiles</span></div>'+
  '<header class="hdr"><div class="hdr-row">'+
   '<div class="side l"><button class="icobtn js-menu" aria-label="Abrir menú" aria-expanded="false">'+ico('i-menu')+'</button><a class="icobtn" href="listado.html#gafas-de-sol" aria-label="Buscar">'+ico('i-search')+'</a></div>'+
   '<a class="logo" href="index.html" aria-label="Sunnygafas, inicio"><img src="assets/isotipo-sunnygafas.png" alt="" width="40" height="32"><span>Sunnygafas</span></a>'+
   '<nav class="nav" aria-label="Principal"><div class="has-mega"><a href="listado.html#gafas-de-sol" aria-haspopup="true" aria-expanded="false">Gafas de sol'+ico('i-down','s')+'</a>'+megaHTML()+'</div><a href="listado.html#polarizadas">Polarizadas</a><a href="listado.html#armazones">Armazones</a><a href="pendiente.html#clip-on">Clip-on 2 en 1</a><a href="listado.html#accesorios">Accesorios</a></nav>'+
   '<div class="side r"><a class="search" href="listado.html#gafas-de-sol">'+ico('i-search')+'<span>Buscar modelo o color</span></a><a class="icobtn" href="cuenta.html" aria-label="Mi cuenta">'+ico('i-user')+'</a><button class="icobtn js-cart" aria-label="Carrito">'+ico('i-bag')+'<span class="count-wrap"></span></button></div>'+
  '</div></header>';
}
function megaHTML(){
  var g=BY.glow;
  return '<div class="mega" hidden><div class="mega-in">'+
   '<div><h4>Colecciones</h4><ul>'+Object.keys(COLSLUG).map(function(s){var c=COLSLUG[s];return '<li><a href="listado.html#'+s+'">'+c+'<small>'+fmt(COL[c])+'</small></a></li>';}).join('')+'<li><a href="listado.html#gafas-de-sol"><b>Ver todas las gafas de sol</b></a></li></ul></div>'+
   '<div><h4>Por forma</h4><ul>'+Object.keys(SHAPES).map(function(s){return '<li><a href="listado.html#forma-'+s+'"><span style="display:flex;gap:10px;align-items:center">'+ico(SHAPE_ICO[s])+SHAPES[s]+'</span></a></li>';}).join('')+'</ul></div>'+
   '<div><h4>También</h4><ul><li><a href="listado.html#polarizadas">Polarizadas<small>desde $80.000</small></a></li><li><a href="pendiente.html#clip-on">Clip-on 2 en 1<small>desde $80.000</small></a></li><li><a href="pendiente.html#guia-de-medidas">Guía de medidas</a></li><li><a href="index.html#polarizadas-o-comunes">¿Polarizadas o comunes?</a></li></ul></div>'+
   '<a class="mega-feat" href="producto.html#glow"><div style="position:relative;aspect-ratio:1;border-radius:8px;overflow:hidden"><img src="'+IMG+'glow-negro.webp" alt="" style="width:100%;height:100%;object-fit:contain;mix-blend-mode:multiply"></div><div style="display:grid;gap:6px"><p style="font-weight:600">Glow · Negro</p><p class="small muted">Colección Básica</p>'+priceHTML(g.list)+'</div></a>'+
  '</div></div>';
}
function offcanvasHTML(){
  return '<div class="ov ov-menu" hidden><div class="ov-scrim js-close"></div><div class="drawer-l" role="dialog" aria-modal="true" aria-label="Menú">'+
   '<div class="drawer-top"><a class="logo" href="index.html"><img src="assets/isotipo-sunnygafas.png" alt="" width="40" height="32"><span>Sunnygafas</span></a><button class="icobtn js-close" aria-label="Cerrar menú">'+ico('i-x')+'</button></div>'+
   '<nav class="mnav" aria-label="Menú mobile"><details open><summary>Gafas de sol'+ico('i-down')+'</summary><a class="sub" href="listado.html#gafas-de-sol">Ver todas</a>'+Object.keys(COLSLUG).map(function(s){return '<a class="sub" href="listado.html#'+s+'">'+COLSLUG[s]+' <small>'+fmt(COL[COLSLUG[s]])+'</small></a>';}).join('')+'</details>'+
   '<a href="listado.html#polarizadas">Polarizadas'+ico('i-chev')+'</a><a href="listado.html#armazones">Armazones'+ico('i-chev')+'</a><a href="pendiente.html#clip-on">Clip-on 2 en 1'+ico('i-chev')+'</a><a href="listado.html#accesorios">Accesorios'+ico('i-chev')+'</a><a href="pendiente.html#ayuda">Ayuda'+ico('i-chev')+'</a></nav>'+
   '<div class="dfoot"><a class="acct" href="cuenta.html">'+ico('i-user')+'Ingresá o creá tu cuenta</a><a class="btn btn-wa btn-block" href="'+WA+'">'+ico('i-chat')+'Escribinos por WhatsApp</a></div></div></div>';
}
function footerHTML(o){
  o=o||{};
  var nl=o.noNl?'':'<section class="sec prefoot" aria-label="Newsletter"><div class="in nlgrid"><div style="display:grid;gap:8px"><h2 class="h2">Te avisamos cuando entran modelos</h2><p class="muted">[Incentivo a definir]. Un email por tanda nueva, nada más.</p></div>'+
   '<form class="nlform js-nl" novalidate><div class="field"><label for="nl-em">Email</label><input id="nl-em" type="email" placeholder="tunombre@gmail.com" autocomplete="email"><p class="help">Te podés dar de baja desde cualquier email.</p></div><button class="btn btn-primary" type="submit">Suscribirme</button></form></div></section>';
  var L=function(h,t){return '<li><a href="'+h+'">'+t+'</a></li>';};
  return nl+'<footer class="foot"><div class="in"><div class="foot-top"><div><a class="logo" href="index.html"><img src="assets/isotipo-sunnygafas.png" alt="" width="40" height="32"><span>Sunnygafas</span></a><p class="foot-intro">Gafas de sol, polarizadas, armazones y cadenas. Venta online desde [ciudad], sin local a la calle.</p>'+
   '<div class="contact"><a class="btn btn-wa" href="'+WA+'">'+ico('i-chat')+'Escribinos por WhatsApp</a><a href="'+WA+'">'+ico('i-chat')+'[+54 9 xx xxxx-xxxx]</a><a href="https://instagram.com/sunnygafas" target="_blank" rel="noopener">'+ico('i-ig')+'@sunnygafas</a><a href="#">'+ico('i-mail')+'sunny.gafas.ch@gmail.com</a></div></div>'+
   '<div class="fcols"><details open><summary>Comprar'+ico('i-down')+'</summary><ul>'+L('listado.html#gafas-de-sol','Gafas de sol')+L('listado.html#polarizadas','Polarizadas')+L('listado.html#armazones','Armazones')+L('pendiente.html#clip-on','Clip-on 2 en 1')+L('listado.html#accesorios','Accesorios')+'</ul></details>'+
   '<details><summary>Ayuda'+ico('i-down')+'</summary><ul>'+L('pendiente.html#envios','Envíos')+L('pendiente.html#pagos','Pagos')+L('pendiente.html#cambios','Cambios y devoluciones')+L('pendiente.html#cuidado','Cuidado de tus gafas')+L('pendiente.html#guia-de-medidas','Guía de medidas')+L('pendiente.html#ayuda','Preguntas frecuentes')+'</ul></details>'+
   '<details><summary>Sunnygafas'+ico('i-down')+'</summary><ul>'+L('pendiente.html#quienes-somos','Quiénes somos')+L('cuenta.html#mayorista','Venta mayorista')+L('pendiente.html#blog','Blog')+L('pendiente.html#contacto','Contacto')+L('cuenta.html','Mi cuenta')+'</ul></details></div></div>'+
   '<div class="foot-mid"><div><h4>Envíos</h4><p class="foot-ship">Correo Argentino a todo el país. Envío personalizado: a acordar por WhatsApp.</p></div><div><h4>Medios de pago</h4><div class="pay"><span>Visa</span><span>Mastercard</span><span>American Express</span><span>Naranja</span><span>Cabal</span><span>Maestro</span><span>Mercado Pago</span><span>Transferencia</span></div></div></div>'+
   '<div class="legal"><a class="btn-regret" href="pendiente.html#arrepentimiento">Botón de arrepentimiento</a><div class="links"><a href="pendiente.html#terminos">Términos y condiciones</a><a href="pendiente.html#privacidad">Privacidad</a><a href="pendiente.html#cambios">Cambios y devoluciones</a><a href="https://www.argentina.gob.ar/produccion/defensadelconsumidor" target="_blank" rel="noopener">Defensa del Consumidor</a></div><p>[Razón social] · CUIT [xx-xxxxxxxx-x] · © 2026 Sunnygafas</p></div>'+
  '</div></footer>';
}
function fabHTML(){return '<div class="fab"><a href="'+WA+'" aria-label="Escribinos por WhatsApp">'+ico('i-chat')+'</a></div>';}
function protoHTML(){
  return '<div class="proto"><button class="proto-btn js-proto" aria-expanded="false">Mapa del prototipo</button><div class="proto-panel" hidden><p><b>Sunnygafas · prototipo de diseño</b><br>Etapas 1 a 3. Precios y productos reales de la tienda actual; los datos entre corchetes faltan.</p><ul>'+
  [['index.html','Home'],['listado.html#gafas-de-sol','Listado: gafas de sol'],['listado.html#polarizadas','Listado: polarizadas'],['listado.html#accesorios','Listado: accesorios'],['producto.html#glow','Ficha: Glow · Negro'],['producto.html#gala','Ficha: Gala (4 colores)'],['carrito.html','Carrito'],['checkout.html','Checkout'],['confirmacion.html','Confirmación'],['cuenta.html','Mi cuenta'],['pendiente.html#quienes-somos','Páginas de la etapa 4']].map(function(x){return '<li><a href="'+x[0]+'">'+x[1]+'</a></li>';}).join('')+
  '</ul><button class="link js-reset" type="button">Vaciar carrito de prueba</button></div></div>';
}

/* ---------- side cart ---------- */
function lineHTML(it,o){
  o=o||{};var p=BY[it.id];if(!p)return '';var v=p.vars[it.v]||p.vars[0];
  var img='<a class="th" href="'+purl(p.id,it.v)+'">'+(o.q?'<span class="q">'+it.q+'</span>':'')+'<img class="'+fc(v.img).trim()+'" src="'+IMG+v.img+'.webp" alt=""></a>';
  var pr='<div class="lp"><b>'+fmt(p.list*it.q)+'</b><small>'+fmt(p.list*it.q*.75)+' transf.</small></div>';
  var nm='<p class="nm"><a href="'+purl(p.id,it.v)+'" style="text-decoration:none">'+p.n+' <span>· '+(v.label||v.c)+'</span></a></p><p class="meta">'+typeLabel(p)+'</p>';
  if(o.mini)return '<div class="line">'+img+nm+pr+'</div>';
  return '<div class="line" data-k="'+it.id+'|'+it.v+'">'+img+nm+pr+'<div class="acts"><div class="stepper" role="group" aria-label="Cantidad de '+p.n+' · '+(v.label||v.c)+'"><button type="button" data-a="dec" aria-label="Restar uno"'+(it.q<=1?' disabled':'')+'>'+ico('i-minus','s')+'</button><output aria-live="polite">'+it.q+'</output><button type="button" data-a="inc" aria-label="Sumar uno">'+ico('i-plus','s')+'</button></div><button class="rm" type="button" data-a="rm">Quitar</button></div></div>';
}
function freebar(){return '<div class="freebar" role="status"><span>Te faltan <b>$[x]</b> para el envío gratis</span><div class="trk" aria-hidden="true"><i style="width:'+Math.min(90,20+cartSub()/1000)+'%"></i></div><small>Monto mínimo a definir con la marca</small></div>';}
function tnote(){var s=cartSub();return '<div class="tnote"><span class="circ">'+ico('i-bank')+'</span><span>Pagando con transferencia o efectivo: <b>'+fmt(s*.75)+'</b>. Ahorrás '+fmt(s*.25)+'. Lo elegís en el checkout.</span></div>';}
function policy(){return '<p class="policy">'+ico('i-refresh')+'<span>Cambios hasta [plazo] días después de recibirlas. <a href="pendiente.html#cambios" style="color:var(--ink)">Ver política de cambios</a></span></p>';}
function xsellHTML(){
  var inCart=cart.map(function(i){return i.id;});
  var pick=['cadena-beige','cadena-gold','cadena-silver','cadena-black'].filter(function(id){return inCart.indexOf(id)<0;}).slice(0,2);
  if(!pick.length||!cart.length)return '';
  return '<div class="xsell"><h3>Sumale una cadena</h3>'+pick.map(function(id){var p=BY[id],v=p.vars[0];return '<div class="xitem"><a class="th" href="'+purl(id)+'"><img src="'+IMG+v.img+'.webp" alt=""></a><span><b>'+p.n+' · '+(v.label||v.c)+'</b><small><em>'+fmt(p.list*.75)+'</em> con transf. · '+fmt(p.list)+'</small></span><button class="btn btn-secondary" type="button" data-add="'+id+'" aria-label="Sumar '+p.n+' · '+(v.label||v.c)+'">Sumar</button></div>';}).join('')+'</div>';
}
function emptyCart(){return '<div class="emptycart">'+'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><use href="#i-bag"/></svg><h3 class="h3">Tu carrito está vacío</h3><p class="muted small">La colección Básica arranca en $20.250 con transferencia.</p><a class="btn btn-primary" href="listado.html#gafas-de-sol">Ver gafas de sol</a></div>';}
function renderSide(){
  var el=$('.sidecart');if(!el)return;var s=cartSub();
  el.innerHTML='<div class="sc-top"><h2 id="sct">Tu carrito ('+cartCount()+')</h2><button class="icobtn js-close" aria-label="Cerrar carrito">'+ico('i-x')+'</button></div>'+
   (cart.length?freebar()+'<div class="sc-body"><div class="lines">'+cart.map(function(i){return lineHTML(i);}).join('')+'</div>'+xsellHTML()+tnote()+'</div>'+
   '<div class="sc-foot"><div class="row"><span>Subtotal</span><b>'+fmt(s)+'</b></div><p class="sub"><span>o 3 × '+fmt(s/3)+' sin interés</span><span>Envío en el checkout</span></p><a class="btn btn-primary btn-block" href="checkout.html">Iniciar compra</a><a class="link" href="carrito.html">Ver carrito</a>'+policy()+'</div>':'<div class="sc-body">'+emptyCart()+'</div>');
}
var lastFocus=null;
function openOv(sel){var o=$(sel);if(!o)return;lastFocus=document.activeElement;o.hidden=false;document.documentElement.classList.add('locked');requestAnimationFrame(function(){o.classList.add('on');var f=$('.js-close:not(.ov-scrim)',o)||$('button',o);if(f)f.focus();});}
function closeOv(o){o.classList.remove('on');document.documentElement.classList.remove('locked');setTimeout(function(){o.hidden=true;},200);if(lastFocus)lastFocus.focus();}
function openCart(){renderSide();openOv('.ov-cart');}
function changeLine(k,a){var p=k.split('|'),it=cart.filter(function(x){return x.id===p[0]&&x.v===+p[1];})[0];if(!it)return;
  if(a==='inc')it.q++;if(a==='dec'&&it.q>1)it.q--;if(a==='rm')cart.splice(cart.indexOf(it),1);save('sg-cart',cart);refreshCount();}

/* ---------- layout común ---------- */
var page=document.body.dataset.page;
var app=$('#app');
function shell(main,o){
  o=o||{};
  app.innerHTML=(o.checkout?'':headerHTML())+'<main id="contenido">'+main+'</main>'+(o.checkout?'':footerHTML(o))+(o.checkout||o.noFab?'':fabHTML())+offcanvasHTML()+
   '<div class="ov ov-cart" hidden><div class="ov-scrim js-close"></div><div class="sidecart" role="dialog" aria-modal="true" aria-labelledby="sct"></div></div>'+protoHTML();
  refreshCount();
}
document.addEventListener('click',function(e){
  var t=e.target;
  if(t.closest('.js-menu')){openOv('.ov-menu');return;}
  if(t.closest('.js-cart')){openCart();return;}
  var c=t.closest('.js-close');if(c){closeOv(c.closest('.ov'));return;}
  var ad=t.closest('[data-add]');if(ad){addToCart(ad.dataset.add,0);renderSide();if(page==='carrito')renderCartPage();return;}
  var ln=t.closest('.line [data-a]');if(ln){changeLine(ln.closest('.line').dataset.k,ln.dataset.a);renderSide();if(page==='carrito')renderCartPage();return;}
  if(t.closest('.js-proto')){var b=t.closest('.js-proto'),pn=b.nextElementSibling;pn.hidden=!pn.hidden;b.setAttribute('aria-expanded',!pn.hidden);return;}
  if(t.closest('.js-reset')){cart=[];save('sg-cart',cart);refreshCount();location.reload();return;}
  var wa=t.closest('a[href="#whatsapp"]');if(wa){e.preventDefault();toast('En el sitio real abre WhatsApp con un mensaje armado. Falta el número.');return;}
});
document.addEventListener('keydown',function(e){if(e.key==='Escape'){$$('.ov.on').forEach(closeOv);$$('.has-mega.open').forEach(function(m){m.classList.remove('open');$('.mega',m).hidden=true;});}});
document.addEventListener('submit',function(e){
  var f=e.target;if(!f.classList.contains('js-nl'))return;e.preventDefault();
  var fld=$('.field',f),inp=$('input',f),h=$('.help',fld),v=inp.value.trim();
  fld.classList.remove('err');fld.classList.remove('ok');
  if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)){fld.classList.add('err');inp.setAttribute('aria-invalid','true');h.innerHTML=ico('i-alert','s')+(v.indexOf('@')<0?'Revisá el email: le falta la arroba y el dominio, por ejemplo @gmail.com.':'Revisá el email: le falta el dominio, por ejemplo @gmail.com.');inp.focus();return;}
  inp.removeAttribute('aria-invalid');h.innerHTML=ico('i-check','s')+'Listo, te anotamos. Revisá tu bandeja para confirmar.';h.style.cssText='color:var(--success);display:flex;gap:6px';
});
function bindMega(){
  $$('.has-mega').forEach(function(m){var a=$('a',m),mg=$('.mega',m),t;
    function open(){clearTimeout(t);m.classList.add('open');mg.hidden=false;a.setAttribute('aria-expanded','true');}
    function close(){t=setTimeout(function(){m.classList.remove('open');mg.hidden=true;a.setAttribute('aria-expanded','false');},120);}
    m.addEventListener('mouseenter',open);m.addEventListener('mouseleave',close);
    a.addEventListener('keydown',function(e){if(e.key==='ArrowDown'||e.key===' '){e.preventDefault();open();var f=$('a',mg);if(f)f.focus();}});
    m.addEventListener('focusout',function(e){if(!m.contains(e.relatedTarget))close();});
  });
}
function toast(msg){var t=$('.toast');if(!t){t=document.createElement('div');t.className='toast';t.setAttribute('role','status');document.body.appendChild(t);}t.textContent=msg;t.classList.add('on');clearTimeout(t._h);t._h=setTimeout(function(){t.classList.remove('on');},3200);}
function annRotate(){var el=$('.ann-m');if(!el||matchMedia('(prefers-reduced-motion: reduce)').matches)return;var m=['25% de descuento con transferencia','3 cuotas sin interés con tarjeta','Despachamos todos los días hábiles'],k=0;
  setInterval(function(){if(document.hidden)return;el.style.opacity=0;setTimeout(function(){k=(k+1)%3;el.textContent=m[k];el.style.opacity=1;},250);},5000);}

/* ---------- HOME ---------- */
var probSets={redonda:['glow','molly','tulum'],cuadrada:['dallas','charlotte','oriana'],cateye:['roxy','yanis','pilot'],aviador:['braga','saturday','aviador-pol']};
var probTxt={redonda:'Suavizan las caras con ángulos marcados: mandíbula cuadrada o frente ancha.',cuadrada:'Dan estructura a las caras redondas u ovaladas.',cateye:'Levantan la mirada. Suman en caras con mentón angosto o forma de corazón.',aviador:'Acompañan casi todas las caras; resaltan en las ovaladas y cuadradas.'};
function pageHome(){
  var chips=Object.keys(probSets).map(function(s,i){return '<button class="chip" aria-pressed="'+(i===0)+'" data-shape="'+s+'">'+ico(SHAPE_ICO[s])+SHAPES[s]+'</button>';}).join('');
  var tiers=Object.keys(COLSLUG).map(function(s,i){var c=COLSLUG[s];return '<div class="tier">'+raysSVG(3+i*2,72,40)+'<div style="display:grid;gap:6px"><h3 class="h3">'+c+'</h3><p class="tp">'+fmt(COL[c])+' de lista</p><p class="muted">'+fmt(COL[c]*.75)+' con transferencia</p><p class="muted">[Qué la define: marco, lente, terminación]</p><a href="listado.html#'+s+'">Ver '+c+'</a></div></div>';}).join('');
  var Y=function(t){return '<span class="yn y">'+ico('i-check')+t+'</span>';},N=function(t){return '<span class="yn n">'+ico('i-x')+t+'</span>';};
  document.body.classList.add('brand');app.classList.add('brand');
  shell(
  '<section class="hero"><div class="ph ph-hero" role="img" aria-label="Foto lifestyle pendiente: mujer con gafas de sol en la ruta, luz de tarde"><div class="ph-tag"><span>Foto lifestyle a reemplazar · mujer con gafas de sol en la ruta, luz de tarde</span></div></div>'+
   '<div class="hero-copy"><h1 class="h-disp">Gafas de sol avaladas por óptico</h1><p>UV400 en todos los modelos. Estuche y líquido limpiador en cada compra.</p><a class="btn btn-primary" href="listado.html#gafas-de-sol">Ver gafas de sol</a></div></section>'+
  '<p class="payline"><strong>25% menos con transferencia o efectivo</strong> · 3 cuotas sin interés con tarjeta</p>'+
  '<section class="sec"><div class="in prob"><div><div class="sec-head"><h2 class="h2">El probador</h2><p class="muted">Elegí una forma y mirá qué modelos la tienen.</p></div><div class="chips" role="group" aria-label="Forma del marco">'+chips+'</div>'+
   '<div class="fit" aria-live="polite"><p class="fitText"></p><span class="tbv">Texto a validar con el óptico</span></div><a class="link probLink" href="#"></a></div><div class="probgrid"></div></div></section>'+
  '<section aria-label="Por qué comprar en Sunnygafas"><div class="in"><div class="trust">'+
   '<div><span class="circ">'+ico('i-sun')+'</span><h3>Protección UV400</h3><p>Filtran los rayos UVA y UVB hasta 400 nm.</p></div><div><span class="circ">'+ico('i-eye')+'</span><h3>Avaladas por óptico</h3><p>[Nombre y apellido], M.N. [n.º]</p></div>'+
   '<div><span class="circ">'+ico('i-gift')+'</span><h3>Estuche de regalo</h3><p>Con líquido limpiador, en cada compra.</p></div><div><span class="circ">'+ico('i-truck')+'</span><h3>Despacho diario</h3><p>Todos los días hábiles, a todo el país.</p></div></div></div></section>'+
  '<section class="sec"><div class="in"><div class="sec-head"><h2 class="h2">Comprá por categoría</h2></div><div class="cats">'+
   '<a class="cat wide" href="listado.html#gafas-de-sol"><div class="ph ph-sol" role="img" aria-label="Foto pendiente"><div class="ph-tag"><span>Foto · pareja en la playa al atardecer</span></div></div><div class="cat-label"><div><h3 class="h3">Gafas de sol</h3><p class="small" style="color:#F3EBDF">Desde $27.000</p></div>'+ico('i-arrow')+'</div></a>'+
   '<a class="cat" href="listado.html#polarizadas"><div class="ph ph-pol" role="img" aria-label="Foto pendiente"><div class="ph-tag"><span>Foto · manejando, reflejo en el parabrisas</span></div></div><div class="cat-label"><div><h3 class="h3">Polarizadas</h3><p class="small" style="color:#F3EBDF">Desde $80.000</p></div>'+ico('i-arrow')+'</div></a>'+
   '<a class="cat" href="listado.html#armazones"><div class="ph ph-arm" role="img" aria-label="Foto pendiente"><div class="ph-tag"><span>Foto · interior, luz de ventana, leyendo</span></div></div><div class="cat-label"><div><h3 class="h3">Armazones</h3><p class="small" style="color:#F3EBDF">Desde $27.000</p></div>'+ico('i-arrow')+'</div></a></div>'+
   '<div class="rows"><a class="rowlink" href="pendiente.html#clip-on"><span class="th"><svg viewBox="0 0 120 48" width="40" fill="none" stroke="#8C7D6C" stroke-width="2.5"><use href="#g-glasses"/></svg></span><span><b>Clip-on 2 en 1</b><small>Armazón con lente de sol que se suma encima. Desde $80.000</small></span>'+ico('i-chev')+'</a>'+
   '<a class="rowlink" href="listado.html#accesorios"><span class="th"><img src="'+IMG+'cadena-gold.webp" alt="" style="object-fit:cover"></span><span><b>Accesorios</b><small>Cadenas para anteojos desde $6.000</small></span>'+ico('i-chev')+'</a>'+
   '<a class="rowlink" href="listado.html#armazones"><span class="th"><img src="'+IMG+'oriana-print.webp" alt=""></span><span><b>Armazones para receta</b><small>Oriana, Risky, Lupe, Coco y más</small></span>'+ico('i-chev')+'</a></div></div></section>'+
  '<section class="sec" style="padding-top:0"><div class="in"><div class="sec-head row"><h2 class="h2">Recién llegadas</h2><a class="link" href="listado.html#gafas-de-sol">Ver todo</a></div><div class="rail">'+['saturday','charlotte','gala','yanis'].map(function(id){return cardHTML(BY[id],{showNew:true});}).join('')+'</div><p class="rail-hint small muted" style="margin-top:8px">Deslizá para ver más</p></div></section>'+
  '<section class="sec band-ink"><div class="in"><div class="colhead"><div class="sec-head" style="margin:0"><h2 class="h2">De Básica a Élite</h2></div><p class="muted">Cuatro colecciones con cuatro precios fijos. Cuantos más rayos, más sube la terminación.</p></div><div class="tiers">'+tiers+'</div><p style="margin-top:24px"><span class="tbv">Criterios además del precio: a confirmar con la marca</span></p></div></section>'+
  '<section class="sec band-mar" id="polarizadas-o-comunes"><div class="in polgrid"><div style="display:grid;gap:16px;align-content:start"><h2 class="h2">¿Polarizadas o comunes?</h2><p class="muted lead">Las dos filtran UV400. Cambia lo que pasa con el reflejo.</p><a class="btn btn-secondary" href="listado.html#polarizadas" style="justify-self:start">Ver gafas polarizadas</a><span class="tbv">Tabla a validar con el óptico</span></div>'+
   '<div class="cmp"><table><caption class="sr">Comparación entre gafas polarizadas y comunes</caption><thead><tr><th scope="col"><span class="sr">Aspecto</span></th><th scope="col">Polarizadas</th><th scope="col">Comunes</th></tr></thead><tbody>'+
   '<tr><th scope="row">UV400</th><td>'+Y('Sí')+'</td><td>'+Y('Sí')+'</td></tr><tr><th scope="row">Reflejo en agua, asfalto y nieve</th><td>'+Y('Lo cortan')+'</td><td>'+N('Lo oscurecen, no lo cortan')+'</td></tr>'+
   '<tr><th scope="row">Pantallas del celu y del auto</th><td>'+N('Algunas se ven con manchas')+'</td><td>'+Y('Se ven normal')+'</td></tr><tr><th scope="row">Van mejor para</th><td>Manejar, playa, pesca</td><td>Ciudad y uso diario</td></tr><tr><th scope="row">Precio de lista</th><td>$80.000 y $87.000</td><td>$27.000 a $67.000</td></tr></tbody></table></div></div></section>'
  );
  var root=app,grid=$('.probgrid'),ft=$('.fitText'),pl=$('.probLink');
  function show(s){grid.innerHTML=probSets[s].map(function(id){return cardHTML(BY[id],{showType:true});}).join('');ft.textContent=probTxt[s];pl.innerHTML='Ver todas las '+SHAPES[s].toLowerCase()+' '+ico('i-arrow','s');pl.href='listado.html#forma-'+s;}
  $$('[data-shape]').forEach(function(b){b.addEventListener('click',function(){$$('[data-shape]').forEach(function(x){x.setAttribute('aria-pressed',x===b);});show(b.dataset.shape);});});
  show('redonda');
}

/* ---------- LISTADO ---------- */
var CATS={
 'gafas-de-sol':{h:'Gafas de sol',intro:'Todas con filtro UV400 y estuche de regalo. Cuatro colecciones con precio fijo, de $27.000 a $67.000, y polarizadas desde $80.000.',f:function(p){return p.cat==='sol'||p.cat==='pol';},crumb:'Gafas de sol'},
 'polarizadas':{h:'Gafas polarizadas',intro:'Cortan el reflejo del agua, la nieve y el asfalto. UV400 y estuche de regalo. Desde $80.000 de lista.',f:function(p){return p.cat==='pol';},crumb:'Polarizadas',note:'Muestra 2 de los 12 modelos polarizados actuales: el resto se carga con sus fotos.'},
 'armazones':{h:'Armazones para receta',intro:'Llevalos a tu óptica para ponerles tus lentes. Desde $27.000 de lista.',f:function(p){return p.cat==='arm';},crumb:'Armazones',note:'Muestra Oriana. Risky, Aron, Lupe y Coco se cargan con sus fotos.'},
 'accesorios':{h:'Cadenas para anteojos',intro:'Para colgar las gafas cuando no las usás. De $6.000 a $11.200 de lista.',f:function(p){return p.cat==='acc';},crumb:'Accesorios'}
};
var PRICES=[{k:'p1',l:'Hasta $30.000',t:function(p){return p.list<=30000;}},{k:'p2',l:'$30.000 a $60.000',t:function(p){return p.list>30000&&p.list<=60000;}},{k:'p3',l:'Más de $60.000',t:function(p){return p.list>60000;}}];
function hasColor(p,c){return p.vars.some(function(v){return v.c===c;})||(p.extraColors||[]).indexOf(c)>-1;}
function pageListado(){
  var h=(location.hash||'#gafas-de-sol').slice(1),key='gafas-de-sol',st={shape:[],color:[],col:[],price:[],pol:false},sort='rec';
  if(CATS[h])key=h;else if(COLSLUG[h])st.col=[COLSLUG[h]];else if(h.indexOf('forma-')===0&&SHAPES[h.slice(6)])st.shape=[h.slice(6)];
  var C=CATS[key],base=P.filter(C.f);
  var showShape=base.some(function(p){return p.shape;}),showCol=base.some(function(p){return p.col;}),showPol=key==='gafas-de-sol';
  var colors=[];base.forEach(function(p){p.vars.forEach(function(v){if(colors.indexOf(v.c)<0&&v.c!=='Print')colors.push(v.c);});});
  var subs=key==='gafas-de-sol'?'<div class="subcats" aria-label="Colecciones">'+Object.keys(COLSLUG).map(function(s){return '<a href="listado.html#'+s+'">'+COLSLUG[s]+' <small>'+fmt(COL[COLSLUG[s]])+'</small></a>';}).join('')+'<a href="listado.html#polarizadas">Polarizadas <small>desde $80.000</small></a></div>':'';
  shell('<div class="in"><nav class="crumbs" aria-label="Migas de pan"><a href="index.html">Inicio</a>'+ico('i-chev')+'<span aria-current="page">'+C.crumb+'</span></nav>'+
   '<div class="plp-head"><h1 class="h1">'+C.h+'</h1><p>'+C.intro+'</p>'+subs+(C.note?'<p class="small" style="color:var(--oro-strong)">Prototipo: '+C.note+'</p>':'')+'</div>'+
   '<div class="toolbar"><button class="btn btn-secondary btn-filter" type="button">'+ico('i-sliders','s')+'Filtrar<span class="fcount"></span></button><p class="count-d"></p><div class="field"><label class="sr" for="sort">Ordenar por</label><select id="sort"><option value="rec">Recomendados</option><option value="new">Más nuevos</option><option value="asc">Menor precio</option><option value="desc">Mayor precio</option></select></div></div>'+
   '<div class="active"></div><div class="plp-body"><aside class="plp-side" aria-label="Filtros"></aside><div><p class="res-count"></p><div class="grid plp"></div><div class="more"><p class="morep"></p><div class="bar"><i></i></div></div></div></div>'+
   '<section class="seo" aria-labelledby="seo-h"><h2 class="h3" id="seo-h">Cómo elegir tus gafas de sol</h2><p>Todas nuestras gafas tienen filtro UV400: bloquean la radiación UVA y UVB hasta 400 nanómetros. El color del lente no cambia esa protección; un lente claro con UV400 protege igual que uno oscuro.</p><div class="rest" hidden><p>La forma depende de tu cara. Las redondas y ovaladas suavizan rasgos marcados y las cuadradas dan estructura a caras redondas. Para el tamaño, compará con unos anteojos que ya tengas usando la guía de medidas.</p><p>Si manejás o vas seguido a la playa, mirá las polarizadas: cortan el reflejo del agua y del asfalto. Pagando con transferencia o efectivo tenés 25% de descuento, y con tarjeta hasta 3 cuotas sin interés.</p></div><button class="link seo-more" type="button" aria-expanded="false">Leer más</button></section><div style="height:48px"></div></div>'+
   '<div class="ov ov-filter" hidden><div class="ov-scrim js-close"></div><div class="drawer-b" role="dialog" aria-modal="true" aria-label="Filtros"><div class="drawer-top"><h2 class="h3">Filtrar</h2><button class="icobtn js-close" aria-label="Cerrar filtros">'+ico('i-x')+'</button></div><div class="drawer-body"></div><div class="drawer-foot"><button class="btn btn-secondary clear-all" type="button">Borrar</button><button class="btn btn-primary see js-close" type="button">Ver modelos</button></div></div></div>');
  var grid=$('.grid.plp'),act=$('.active');
  function cnt(fn){return base.filter(fn).length;}
  function panel(){
    return '<div class="fpanel">'+
    (showShape?'<div class="fgroup"><h3>Forma</h3>'+Object.keys(SHAPES).filter(function(s){return cnt(function(p){return p.shape===s;});}).map(function(s){return '<label class="check"><input type="checkbox" data-f="shape" value="'+s+'"'+(st.shape.indexOf(s)>-1?' checked':'')+'>'+ico(SHAPE_ICO[s])+SHAPES[s]+'<small>'+cnt(function(p){return p.shape===s;})+'</small></label>';}).join('')+'</div>':'')+
    '<div class="fgroup"><h3>Color</h3><div class="fsw">'+colors.map(function(c){return '<label><input type="checkbox" data-f="color" value="'+c+'"'+(st.color.indexOf(c)>-1?' checked':'')+'><i style="background:'+HEX[c]+'"></i><span>'+c+'</span></label>';}).join('')+'</div></div>'+
    (showPol?'<div class="fgroup"><label class="toggle"><span><b style="font-weight:700">Solo polarizadas</b><br><span class="small muted">Cortan el reflejo del agua y el asfalto</span></span><input type="checkbox" role="switch" data-f="pol"'+(st.pol?' checked':'')+'></label></div>':'')+
    (showCol?'<div class="fgroup"><h3>Colección</h3>'+Object.keys(COL).map(function(c){return '<label class="check"><input type="checkbox" data-f="col" value="'+c+'"'+(st.col.indexOf(c)>-1?' checked':'')+'>'+c+'<small>'+fmt(COL[c])+'</small></label>';}).join('')+'</div>':'')+
    '<div class="fgroup" style="border-bottom:0"><h3>Precio de lista</h3>'+PRICES.filter(function(x){return cnt(x.t);}).map(function(x){return '<label class="check"><input type="checkbox" data-f="price" value="'+x.k+'"'+(st.price.indexOf(x.k)>-1?' checked':'')+'>'+x.l+'<small>'+cnt(x.t)+'</small></label>';}).join('')+'</div></div>';
  }
  function label(f,v){return f==='shape'?SHAPES[v]:f==='price'?PRICES.filter(function(x){return x.k===v;})[0].l:f==='col'?'Colección '+v:v;}
  function render(){
    var list=base.filter(function(p){
      if(st.shape.length&&st.shape.indexOf(p.shape)<0)return false;
      if(st.color.length&&!st.color.some(function(c){return hasColor(p,c);}))return false;
      if(st.col.length&&st.col.indexOf(p.col)<0)return false;
      if(st.pol&&!p.pol)return false;
      if(st.price.length&&!PRICES.filter(function(x){return st.price.indexOf(x.k)>-1;}).some(function(x){return x.t(p);}))return false;
      return true;});
    if(sort==='asc')list.sort(function(a,b){return a.list-b.list;});
    if(sort==='desc')list.sort(function(a,b){return b.list-a.list;});
    if(sort==='new')list.sort(function(a,b){return (b.isNew?1:0)-(a.isNew?1:0);});
    var n=list.length,nf=st.shape.length+st.color.length+st.col.length+st.price.length+(st.pol?1:0),colorPick=st.color.length===1?st.color[0]:null;
    grid.innerHTML=n?list.map(function(p){return cardHTML(p,{color:colorPick,showNew:true});}).join(''):'<div class="empty"><svg viewBox="0 0 120 48" fill="none" stroke="currentColor" stroke-width="1.25"><use href="#g-glasses"/></svg><h3 class="h3">No hay modelos con estos filtros</h3><p class="muted">Sacá un filtro para ver más, o escribinos y te contamos si entran.</p><button class="btn btn-secondary clear-all" type="button">Borrar filtros</button></div>';
    var chips=[];['shape','color','col','price'].forEach(function(f){st[f].forEach(function(v){chips.push('<button class="achip" data-f="'+f+'" data-v="'+v+'" aria-label="Sacar filtro '+label(f,v)+'">'+label(f,v)+ico('i-x')+'</button>');});});
    if(st.pol)chips.push('<button class="achip" data-f="pol" aria-label="Sacar filtro Polarizadas">Polarizadas'+ico('i-x')+'</button>');
    act.innerHTML=chips.length?chips.join('')+'<button class="clear clear-all" type="button">Borrar todo</button>':'';
    var txt=n+(n===1?' modelo':' modelos');$('.res-count').textContent=txt;$('.count-d').textContent=txt;$('.fcount').textContent=nf?' ('+nf+')':'';
    $('.morep').textContent='Viste '+n+' de '+n+' modelos';$('.bar i').style.width='100%';$('.more').hidden=!n;
    $('.plp-side').innerHTML=panel();$('.ov-filter .drawer-body').innerHTML=panel();$('.ov-filter .see').textContent='Ver '+txt;
  }
  app.addEventListener('change',function(e){var t=e.target;if(t.id==='sort'){sort=t.value;render();return;}if(!t.dataset.f)return;var f=t.dataset.f;
    if(f==='pol')st.pol=t.checked;else{var a=st[f],i=a.indexOf(t.value);if(t.checked&&i<0)a.push(t.value);if(!t.checked&&i>-1)a.splice(i,1);}render();});
  app.addEventListener('click',function(e){
    var c=e.target.closest('.achip');if(c){var f=c.dataset.f;if(f==='pol')st.pol=false;else st[f].splice(st[f].indexOf(c.dataset.v),1);render();return;}
    if(e.target.closest('.clear-all')){st={shape:[],color:[],col:[],price:[],pol:false};render();return;}
    if(e.target.closest('.btn-filter')){openOv('.ov-filter');return;}
    var m=e.target.closest('.seo-more');if(m){var r=$('.seo .rest'),o=m.getAttribute('aria-expanded')==='true';r.hidden=o;m.setAttribute('aria-expanded',!o);m.textContent=o?'Leer más':'Leer menos';}
  });
  render();
  window.addEventListener('hashchange',function(){location.reload();});
}

/* ---------- FICHA ---------- */
function pageProducto(){
  var h=(location.hash||'#glow').slice(1),m=h.match(/^(.*?)(?:-(\d+))?$/),p=BY[m[1]]||BY[h]||BY.glow,vi=m[2]&&BY[m[1]]?+m[2]:0;
  if(!BY[m[1]]&&BY[h]){p=BY[h];vi=0;}
  if(!p.vars[vi])vi=0;
  var v=p.vars[vi],gal=(v.gal||[v.img]),catLink=p.cat==='acc'?['listado.html#accesorios','Accesorios']:p.cat==='arm'?['listado.html#armazones','Armazones']:p.cat==='pol'?['listado.html#polarizadas','Polarizadas']:['listado.html#gafas-de-sol','Gafas de sol'];
  var isGlasses=p.cat!=='acc';
  document.title=p.n+' · '+(v.label||v.c)+' · Sunnygafas';
  var figs=gal.map(function(g,i){return '<figure class="'+(i===0?'on':'')+'"><img class="'+fc(g).trim()+'" src="'+IMG+g+'.webp" alt="'+p.n+' · '+(v.label||v.c)+', foto '+(i+1)+'"></figure>';}).join('')+(isGlasses?'<figure class="worn"><div><svg viewBox="0 0 120 48" fill="none" stroke="currentColor" stroke-width="1.25"><use href="#g-glasses"/></svg><b style="color:var(--ink)">Foto puesta</b><span>Pedir a la marca: '+p.n+' puesto, de frente y de perfil, luz natural.</span></div></figure>':'');
  var nImg=gal.length+(isGlasses?1:0);
  var thumbs=gal.map(function(g,i){return '<button type="button" aria-label="Ver foto '+(i+1)+'" aria-current="'+(i===0)+'" data-i="'+i+'"><img class="'+fc(g).trim()+'" src="'+IMG+g+'.webp" alt=""></button>';}).join('')+(isGlasses?'<button type="button" aria-label="Ver foto puesta" data-i="'+gal.length+'"><span class="worn-th">Puesta</span></button>':'');
  var sw=p.vars.map(function(x,i){return '<a role="radio" aria-checked="'+(i===vi)+'" aria-label="'+(x.label||x.c)+'" href="'+purl(p.id,i)+'" class="swa'+(i===vi?' on':'')+'"><i style="background:'+HEX[x.c]+'"></i></a>';}).join('')+(p.extra?'<span class="small muted" style="align-self:center;padding-left:4px">+'+p.extra+' sin foto todavía</span>':'');
  var looks=['cadena-gold','cadena-silver','cadena-beige','cadena-black'].filter(function(id){return id!==p.id;}).slice(0,4);
  var badge=p.col?'Colección '+p.col:p.pol?'Polarizada':p.cat==='arm'?'Armazón':'Accesorio';
  var bcls=p.pol?'b-pol':p.col?'b-col':'b-type';
  var specs=isGlasses?'<tr><th scope="row">Ancho total</th><td class="tbd">[xxx] mm</td></tr><tr><th scope="row">Ancho de lente</th><td class="tbd">[xx] mm</td></tr><tr><th scope="row">Puente</th><td class="tbd">[xx] mm</td></tr><tr><th scope="row">Largo de varilla</th><td class="tbd">[xxx] mm</td></tr><tr><th scope="row">Material del marco</th><td class="tbd">[a confirmar]</td></tr><tr><th scope="row">Tipo de lente</th><td class="tbd">'+(p.cat==='arm'?'Sin graduar, para tus lentes':'[a confirmar]')+'</td></tr><tr><th scope="row">Protección</th><td>'+(p.cat==='arm'?'—':'UV400')+'</td></tr><tr><th scope="row">Polarizada</th><td>'+(p.pol?'Sí':'No')+'</td></tr>':'<tr><th scope="row">Largo</th><td class="tbd">[xx] cm</td></tr><tr><th scope="row">Material</th><td class="tbd">'+(p.id==='cadena-beige'?'Acrílico':'[a confirmar]')+'</td></tr><tr><th scope="row">Enganche</th><td class="tbd">[a confirmar]</td></tr>';
  var Mx='<svg class="measure" viewBox="0 0 520 260" fill="none" stroke="currentColor" stroke-width="1.5" role="img" aria-label="Dibujo de un armazón con sus cuatro medidas"><ellipse cx="150" cy="120" rx="90" ry="58"/><ellipse cx="370" cy="120" rx="90" ry="58"/><path d="M240 108c10-14 30-14 40 0"/><path d="M60 104H40M460 104h20"/><g stroke="#1D5A60" stroke-width="1"><path d="M40 40H480M40 34v12M480 34v12"/><path d="M60 205H240M60 199v12M240 199v12"/><path d="M240 175H280M240 169v12M280 169v12"/><path d="M40 250H200M40 244v12M200 244v12"/></g><text x="260" y="30" text-anchor="middle">Ancho total</text><text x="150" y="226" text-anchor="middle">Lente</text><text x="260" y="196" text-anchor="middle">Puente</text><path d="M40 238h150c8 0 14-4 18-10" stroke-dasharray="3 4" stroke-width="1"/><text x="230" y="254">Varilla (vista lateral)</text></svg>';
  shell('<div class="in"><nav class="crumbs" aria-label="Migas de pan"><a href="index.html">Inicio</a>'+ico('i-chev')+'<a href="'+catLink[0]+'">'+catLink[1]+'</a>'+(p.col?ico('i-chev')+'<a href="listado.html#'+Object.keys(COLSLUG).filter(function(s){return COLSLUG[s]===p.col;})[0]+'">'+p.col+'</a>':'')+ico('i-chev')+'<span aria-current="page">'+p.n+'</span></nav>'+
   '<div class="pdp-grid"><div class="gal"><div class="galwrap"><div class="gal-main" tabindex="0" aria-label="Fotos de '+p.n+'">'+figs+'</div><span class="gal-count">1 / '+nImg+'</span></div><div class="thumbs">'+thumbs+'</div><div class="dots" aria-hidden="true">'+Array.apply(null,Array(nImg)).map(function(_,i){return '<i class="'+(i?'':'on')+'"></i>';}).join('')+'</div></div>'+
   '<div class="buy"><div class="title"><span><span class="badge '+bcls+'">'+badge+'</span></span><h1 class="h1">'+p.n+' <span>· '+(v.label||v.c)+'</span></h1></div>'+priceHTML(p.list,'bigprice')+
    '<a class="link" href="#medios" style="min-height:32px;font-size:15px">Ver medios de pago</a>'+
    '<div><p class="optlabel">Color: <b>'+(v.label||v.c)+'</b></p><div class="sw big" role="radiogroup" aria-label="Color">'+sw+'</div></div>'+
    '<div class="ctas"><button class="btn btn-primary btn-block js-add" type="button">Agregar al carrito</button><a class="btn btn-wa btn-block" href="'+WA+'">'+ico('i-chat')+'Consultar por WhatsApp</a></div>'+
    '<div class="reassure"><p>'+ico('i-truck')+'<span>Despachamos todos los días hábiles a todo el país.</span></p><p>'+ico('i-refresh')+'<span>Cambios hasta [plazo] días después de recibirlas. <a href="pendiente.html#cambios" style="color:var(--ink)">Ver política</a></span></p>'+(isGlasses?'<p>'+ico('i-eye')+'<span>Avaladas por [nombre del óptico], M.N. [n.º]</span></p>':'')+'</div>'+
    '<form class="shipbox js-ship" novalidate><h2>'+ico('i-truck','s')+'Calculá el envío</h2><div class="inline"><div class="field"><label for="cp">Código postal</label><input id="cp" inputmode="numeric" placeholder="Ej: 5000" autocomplete="postal-code" maxlength="8"><p class="help" hidden></p></div><button class="btn btn-secondary" type="submit">Calcular</button></div><div class="shipres" aria-live="polite" hidden></div><a class="link" href="https://www.correoargentino.com.ar/formularios/cpa" target="_blank" rel="noopener" style="min-height:32px;font-size:14px">No sé mi código postal</a></form>'+
   '</div></div>'+
   '<div class="info2"><div><section class="blk" aria-labelledby="desc-h"><h2 class="h2" id="desc-h">Sobre '+p.n+'</h2><div class="desc">'+(p.desc||'<p class="muted">[Descripción a cargar por la marca: forma, colores, para qué caras va y materiales.]</p>')+'</div></section>'+
    '<section class="blk" aria-labelledby="box-h"><h2 class="h3" id="box-h">Qué trae la caja</h2><div class="box"><div>'+ico(isGlasses?'i-sun':'i-box')+p.n+' · '+(v.label||v.c)+'</div>'+(isGlasses?'<div>'+ico('i-case')+'Estuche</div><div>'+ico('i-drop')+'Líquido limpiador</div>':'<div>'+ico('i-case')+'[Bolsita o caja a confirmar]</div>')+'</div></section></div>'+
    '<section class="blk" aria-labelledby="spec-h"><h2 class="h3" id="spec-h">Especificaciones</h2><div class="specs"><table><caption class="sr">Especificaciones</caption><tbody>'+specs+'</tbody></table></div></section></div>'+
   (isGlasses?'<section class="blk" aria-labelledby="fit-h"><div class="fitguide"><div style="display:grid;gap:12px"><h2 class="h2" id="fit-h">¿Me va a quedar bien?</h2><p class="muted">Compará con unos anteojos que ya uses y te queden cómodos.</p><ol><li>Buscá en la varilla tres números, por ejemplo <b>52□18-140</b>: ancho de lente, puente y largo de varilla, en milímetros.</li><li>Comparalos con los de '+p.n+' en la tabla. Con 2 o 3 mm de diferencia, el calce va a ser parecido.</li><li>Si no encontrás los números, medí el ancho total de punta a punta y comparalo.</li></ol><p><a class="link" href="pendiente.html#guia-de-medidas">Ver la guía de medidas completa</a></p></div>'+Mx+'</div></section>':'')+
   '<section class="blk" id="medios" aria-labelledby="acc-h"><h2 class="h3" id="acc-h">Envíos, pagos, cambios y cuidado</h2><div class="acc">'+
    '<details open><summary>Envíos'+ico('i-plus')+'</summary><div class="body"><p>Despachamos todos los días hábiles por Correo Argentino, a domicilio o a sucursal. Cuando sale tu pedido te llega el código de seguimiento por email.</p><p>¿Necesitás otra forma? Coordinamos un <strong>envío personalizado</strong> por WhatsApp.</p></div></details>'+
    '<details><summary>Medios de pago'+ico('i-plus')+'</summary><div class="body"><p><strong>Transferencia o efectivo:</strong> 25% de descuento, se ve aplicado en el checkout.</p><p><strong>Tarjetas</strong> Visa, Mastercard, American Express, Naranja, Cabal y Maestro, en hasta 3 cuotas sin interés por Mercado Pago.</p></div></details>'+
    '<details><summary>Cambios y devoluciones'+ico('i-plus')+'</summary><div class="body"><p>Tenés [plazo] días desde que las recibís para cambiarlas, sin uso y con su estuche. Escribinos por WhatsApp y te decimos cómo enviarlas.</p><p>Si te arrepentís de la compra, tenés 10 días corridos para cancelarla con el <strong>botón de arrepentimiento</strong> del pie de página.</p></div></details>'+
    '<details><summary>Cuidado'+ico('i-plus')+'</summary><div class="body"><p>Limpialas con el líquido de regalo y un paño de microfibra; la remera y el papel rayan el lente. Guardalas en el estuche y no las dejes al sol dentro del auto: el calor deforma el marco.</p></div></details></div></section>'+
   '<section class="blk" aria-labelledby="look-h" style="padding-bottom:64px"><div class="sec-head row" style="margin:0"><h2 class="h2" id="look-h">'+(isGlasses?'Completá el look':'Otras cadenas')+'</h2><a class="link" href="listado.html#accesorios">Ver cadenas</a></div><div class="grid look">'+looks.map(function(id){return cardHTML(BY[id]);}).join('')+'</div></section></div>'+
   '<div class="stickybar" role="region" aria-label="Compra rápida"><p class="p-transfer"><b>'+fmt(p.list*.75)+'</b>con transferencia</p><button class="btn btn-primary btn-block js-add" type="button">Agregar al carrito</button></div>',{noFab:true});
  var figsEl=$$('.gal-main figure'),th=$$('.thumbs button'),main=$('.gal-main'),cntEl=$('.gal-count'),dots=$$('.dots i');
  th.forEach(function(b){b.addEventListener('click',function(){var i=+b.dataset.i;figsEl.forEach(function(f,j){f.classList.toggle('on',i===j);});th.forEach(function(x){x.setAttribute('aria-current',x===b);});});});
  figsEl.forEach(function(f){var img=$('img',f);if(!img)return;f.addEventListener('mousemove',function(e){if(innerWidth<1000)return;var r=f.getBoundingClientRect();img.style.transformOrigin=((e.clientX-r.left)/r.width*100)+'% '+((e.clientY-r.top)/r.height*100)+'%';img.style.transform='scale(2)';});f.addEventListener('mouseleave',function(){img.style.transform='';});});
  main.addEventListener('scroll',function(){var i=Math.round(main.scrollLeft/main.clientWidth);cntEl.textContent=(i+1)+' / '+nImg;dots.forEach(function(d,j){d.classList.toggle('on',i===j);});});
  $$('.js-add').forEach(function(b){b.addEventListener('click',function(){var old=b.textContent;b.disabled=true;b.textContent='Agregando…';setTimeout(function(){addToCart(p.id,vi);b.disabled=false;b.textContent=old;openCart();},450);});});
  $('.js-ship').addEventListener('submit',function(e){e.preventDefault();var inp=$('#cp'),fld=inp.parentNode,h=$('.help',fld),res=$('.shipres'),v=inp.value.replace(/\D/g,'');
    fld.classList.remove('err');h.hidden=true;res.hidden=true;inp.removeAttribute('aria-invalid');
    if(v.length!==4){fld.classList.add('err');inp.setAttribute('aria-invalid','true');h.hidden=false;h.innerHTML=ico('i-alert','s')+(v.length<4?'Faltan números: el código postal tiene 4 (por ejemplo, 5000).':'Sobran números: usá los 4 del código postal (por ejemplo, 5000).');inp.focus();return;}
    res.hidden=false;res.innerHTML='<div><b>Correo Argentino a domicilio</b><span>$[costo]</span><small>Llega en [x a y] días hábiles a '+v+'</small></div><div><b>Correo Argentino a sucursal</b><span>$[costo]</span><small>Retirás en la sucursal que elijas</small></div><div><b>Envío personalizado</b><span>A acordar</span><small>Lo coordinamos por WhatsApp</small></div>';});
  window.addEventListener('hashchange',function(){location.reload();});
}

/* ---------- CARRITO ---------- */
function renderCartPage(){
  var s=cartSub(),m=$('#cart-root');if(!m)return;
  if(!cart.length){m.innerHTML='<div class="cart-h"><h1 class="h1">Tu carrito</h1></div>'+emptyCart();return;}
  m.innerHTML='<div class="cart-h"><h1 class="h1">Tu carrito</h1><span class="muted small">'+cartCount()+(cartCount()===1?' producto':' productos')+'</span></div>'+
   '<div class="cart-grid"><div><div style="margin-inline:-16px">'+freebar()+'</div><div class="lines">'+cart.map(function(i){return lineHTML(i);}).join('')+'</div><div style="padding-top:24px;display:grid;gap:16px">'+xsellHTML()+'</div></div>'+
   '<aside class="summary" aria-label="Resumen"><div class="sumcard"><h2>Resumen</h2><div class="sumrows"><div><span>Subtotal</span><span>'+fmt(s)+'</span></div><div><span>Envío</span><span class="muted">Se calcula en el checkout</span></div><div class="tot"><span>Total</span><span>'+fmt(s)+'<small>o 3 × '+fmt(s/3)+' sin interés</small></span></div><div class="tax"><span>Precio sin imp. nacionales</span><span>'+fmt(Math.round(s/1.21))+'</span></div></div>'+
   tnote()+'<a class="btn btn-primary btn-block" href="checkout.html">Iniciar compra</a>'+policy()+'</div><a class="btn btn-wa btn-block" href="'+WA+'">'+ico('i-chat')+'¿Dudas? Escribinos por WhatsApp</a></aside></div>';
}
function pageCarrito(){shell('<div class="in"><nav class="crumbs" aria-label="Migas de pan"><a href="index.html">Inicio</a>'+ico('i-chev')+'<span aria-current="page">Carrito</span></nav><div id="cart-root"></div><div style="height:64px"></div></div>',{noNl:true});renderCartPage();}

/* ---------- CHECKOUT ---------- */
var PROV=['Buenos Aires','CABA','Catamarca','Chaco','Chubut','Córdoba','Corrientes','Entre Ríos','Formosa','Jujuy','La Pampa','La Rioja','Mendoza','Misiones','Neuquén','Río Negro','Salta','San Juan','San Luis','Santa Cruz','Santa Fe','Santiago del Estero','Tierra del Fuego','Tucumán'];
function pageCheckout(){
  if(!cart.length){shell('<div class="in" style="padding-block:48px">'+emptyCart()+'</div>',{noNl:true});return;}
  var s=cartSub();
  function f(id,l,attrs,cls,help){return '<div class="field '+(cls||'')+'"><label for="'+id+'">'+l+'</label><input id="'+id+'" '+(attrs||'')+'><p class="help">'+(help||'')+'</p></div>';}
  function summ(){return '<div class="lines-mini">'+cart.map(function(i){return lineHTML(i,{mini:true,q:true});}).join('')+'</div><div class="sumrows co-rows" aria-live="polite"></div>';}
  shell('<header class="co-hdr"><div class="row"><a class="back" href="carrito.html">'+ico('i-chev')+'<span><span class="d">Volver al </span>carrito</span></a><a class="logo" href="index.html" aria-label="Sunnygafas, inicio"><img src="assets/isotipo-sunnygafas.png" alt="" width="40" height="32"><span>Sunnygafas</span></a><a class="help" href="'+WA+'">'+ico('i-chat')+'<span>Ayuda</span></a></div></header>'+
  '<details class="co-sum-m"><summary><span>Ver resumen ('+cartCount()+')</span><b class="co-total-m">'+fmt(s)+'</b></summary><div class="inner">'+summ()+'</div></details>'+
  '<div class="in"><div class="co-grid"><form class="co-main" novalidate>'+
   '<section class="step"><h2><span class="n">1</span>Contacto</h2><p class="aside">¿Ya tenés cuenta? <a href="cuenta.html" style="color:var(--ink);font-weight:600">Ingresá</a></p>'+
    '<div class="fgrid">'+f('em','Email','type="email" autocomplete="email" required','full','Te mandamos la confirmación y el seguimiento.')+f('tel','Teléfono','type="tel" inputmode="tel" autocomplete="tel" required','','Por si Correo Argentino necesita ubicarte.')+f('dni','DNI','inputmode="numeric" required','','Lo pide Correo Argentino para entregar.')+'</div>'+
    '<label class="terms"><input type="checkbox"><span>Quiero recibir un email cuando entren modelos nuevos</span></label></section>'+
   '<section class="step"><h2><span class="n">2</span>Entrega</h2><fieldset style="border:0;padding:0;margin:0"><legend class="sr">Forma de entrega</legend><div class="opts">'+
    '<label class="opt"><input type="radio" name="ship" value="home" checked><b>Correo Argentino a domicilio</b><span class="amt">$[costo]</span><small>Llega en [x a y] días hábiles</small></label>'+
    '<label class="opt"><input type="radio" name="ship" value="branch"><b>Correo Argentino a sucursal</b><span class="amt">$[costo]</span><small>Retirás en la sucursal que elijas</small><div class="extra"><div class="field"><label for="suc">Sucursal</label><select id="suc"><option>Primero completá tu código postal</option></select></div></div></label>'+
    '<label class="opt"><input type="radio" name="ship" value="custom"><b>Envío personalizado</b><span class="amt">A acordar</span><small>Te escribimos por WhatsApp para coordinar forma y costo antes de despachar.</small></label></div></fieldset>'+
   '<div class="fgrid addr">'+f('nom','Nombre','autocomplete="given-name" required')+f('ape','Apellido','autocomplete="family-name" required')+f('calle','Calle','autocomplete="address-line1" required','s4')+f('num','Número','inputmode="numeric" required','s2')+f('piso','Piso y depto <span class="muted" style="font-weight:400">(opcional)</span>','autocomplete="address-line2"','s2')+f('cpc','Código postal','inputmode="numeric" autocomplete="postal-code" required','s2')+f('loc','Localidad','autocomplete="address-level2" required','s2')+
    '<div class="field full"><label for="prov">Provincia</label><select id="prov" autocomplete="address-level1">'+PROV.map(function(p){return '<option'+(p==='Córdoba'?' selected':'')+'>'+p+'</option>';}).join('')+'</select></div></div></section>'+
   '<section class="step" style="border-bottom:0"><h2><span class="n">3</span>Pago</h2><fieldset style="border:0;padding:0;margin:0"><legend class="sr">Medio de pago</legend><div class="opts">'+
    '<label class="opt"><input type="radio" name="pay" value="transfer" checked><b>Transferencia o efectivo <span class="badge b-disc" style="margin-left:6px;vertical-align:1px">−25%</span></b><span class="amt">'+fmt(s*.75)+'<em>en lugar de '+fmt(s)+'</em></span><small>Te mostramos los datos bancarios al confirmar. Tenés [x] horas para transferir.</small></label>'+
    '<label class="opt"><input type="radio" name="pay" value="card"><b>Tarjeta de débito o crédito</b><span class="amt">'+fmt(s)+'<em>hasta 3 × '+fmt(s/3)+'</em></span><small>Pagás en Mercado Pago, sin interés en hasta 3 cuotas.</small><div class="paylogos"><span>Visa</span><span>Mastercard</span><span>Amex</span><span>Naranja</span><span>Cabal</span><span>Maestro</span></div></label></div></fieldset></section>'+
   '<div class="mob-sum"><div style="background:var(--piedra);border-radius:12px;padding:16px"><h2 class="h3" style="margin-bottom:8px">Tu pedido</h2>'+summ()+'</div></div>'+
   '<div class="paybtn"><label class="terms"><input type="checkbox" id="tyc"><span>Leí y acepto los <a href="pendiente.html#terminos" style="color:var(--ink)">términos y condiciones</a> y la <a href="pendiente.html#cambios" style="color:var(--ink)">política de cambios</a>.</span></label><p class="help tyc-err" hidden style="color:var(--error);text-align:left"></p><button class="btn btn-primary btn-block co-btn" type="submit">Confirmar compra</button><p class="co-btn-note"></p><button type="button" class="link js-fill" style="justify-self:center;font-size:14px">Prototipo: completar con datos de ejemplo</button></div>'+
  '</form><aside class="co-side" aria-label="Resumen del pedido"><h2>Tu pedido</h2>'+summ()+'</aside></div>'+
  '<div class="legal" style="color:var(--ink-muted);border-color:var(--line-soft);margin-top:24px;padding-bottom:32px"><a class="btn btn-secondary" href="pendiente.html#arrepentimiento" style="height:44px">Botón de arrepentimiento</a><div class="links"><a href="pendiente.html#terminos" style="color:var(--ink-muted)">Términos y condiciones</a><a href="pendiente.html#privacidad" style="color:var(--ink-muted)">Privacidad</a></div><p>[Razón social] · CUIT [xx-xxxxxxxx-x]</p></div></div>',{checkout:true});
  var form=$('.co-main');
  function update(){
    var pay=$('input[name="pay"]:checked').value,ship=$('input[name="ship"]:checked').value,disc=pay==='transfer'?s*.25:0,prod=s-disc;
    var html='<div><span>Subtotal</span><span>'+fmt(s)+'</span></div>'+(disc?'<div class="disc"><span>Descuento transferencia (25%)</span><span>'+fmt(-disc)+'</span></div>':'')+'<div><span>Envío</span><span>'+(ship==='custom'?'A acordar':'$[costo]')+'</span></div><div class="tot"><span>Total</span><span>'+fmt(prod)+' + envío<small>'+(pay==='card'?'o 3 × '+fmt(s/3)+' sin interés':'Pagás por transferencia o efectivo')+'</small></span></div><div class="tax"><span>Precio sin imp. nacionales</span><span>'+fmt(Math.round(prod/1.21))+'</span></div>';
    $$('.co-rows').forEach(function(r){r.innerHTML=html;});$('.co-total-m').textContent=fmt(prod);
    $('.co-btn').textContent=pay==='card'?'Pagar con Mercado Pago':'Confirmar compra';
    $('.co-btn-note').textContent=pay==='card'?'Te llevamos a Mercado Pago para completar el pago con tu tarjeta.':'Al confirmar ves los datos para transferir. También te los mandamos por email.';
    $('.addr').hidden=ship==='custom';
  }
  var rules={em:[/^[^@\s]+@[^@\s]+\.[^@\s]+$/,'Revisá el email: le falta el dominio, por ejemplo @gmail.com.'],tel:[/^[\d\s()+-]{8,}$/,'Sumá la característica y el número completo, por ejemplo 351 555 1234.'],dni:[/^\d{7,8}$/,'El DNI tiene 7 u 8 números, sin puntos.'],nom:[/\S/,'Completá tu nombre.'],ape:[/\S/,'Completá tu apellido.'],calle:[/\S/,'Completá la calle.'],num:[/^\d+/,'Poné la altura de la calle, por ejemplo 450.'],cpc:[/^\d{4}$/,'El código postal tiene 4 números, por ejemplo 5000.'],loc:[/\S/,'Completá la localidad.']};
  var helps={};$$('.co-main .field .help').forEach(function(h){helps[h.previousElementSibling&&h.previousElementSibling.id]=h.innerHTML;});
  function check(inp){var r=rules[inp.id];if(!r)return true;if(inp.closest('.addr')&&$('.addr').hidden)return true;var fld=inp.parentNode,h=$('.help',fld),ok=r[0].test(inp.value.trim());
    fld.classList.toggle('err',!ok);if(!ok){inp.setAttribute('aria-invalid','true');h.innerHTML=ico('i-alert','s')+r[1];}else{inp.removeAttribute('aria-invalid');h.innerHTML=helps[inp.id]||'';}return ok;}
  form.addEventListener('focusout',function(e){if(e.target.matches('input')&&e.target.value)check(e.target);});
  form.addEventListener('change',update);
  $('.js-fill').addEventListener('click',function(){var d={em:'martina.gomez@gmail.com',tel:'351 555 1234',dni:'32456789',nom:'Martina',ape:'Gómez',calle:'Av. Hipólito Yrigoyen',num:'450',piso:'3° B',cpc:'5000',loc:'Córdoba'};Object.keys(d).forEach(function(k){$('#'+k).value=d[k];check($('#'+k));});$('#tyc').checked=true;});
  form.addEventListener('submit',function(e){e.preventDefault();var bad=null;Object.keys(rules).forEach(function(id){var i=$('#'+id);if(!check(i)&&!bad)bad=i;});
    var te=$('.tyc-err');te.hidden=$('#tyc').checked;te.innerHTML=ico('i-alert','s')+' Aceptá los términos para seguir.';
    if(bad){bad.focus();return;}if(!$('#tyc').checked){$('#tyc').focus();return;}
    var b=$('.co-btn'),pay=$('input[name="pay"]:checked').value;b.disabled=true;b.textContent='Confirmando tu compra…';
    save('sg-order',{pay:pay,ship:$('input[name="ship"]:checked').value,items:cart.slice(),name:$('#nom').value||'Martina',email:$('#em').value,addr:$('#calle').value+' '+$('#num').value+($('#piso').value?', '+$('#piso').value:'')+' · '+$('#cpc').value+' '+$('#loc').value});
    setTimeout(function(){location.href='confirmacion.html';},900);});
  update();
}

/* ---------- CONFIRMACIÓN ---------- */
function pageConfirmacion(){
  var o=load('sg-order',null);
  if(!o)o={pay:'transfer',ship:'home',items:[{id:'glow',v:0,q:1},{id:'cadena-gold',v:0,q:1}],name:'Martina',email:'martina.gomez@gmail.com',addr:'Av. Hipólito Yrigoyen 450, 3° B · 5000 Córdoba'};
  cart=[];save('sg-cart',cart);
  var s=o.items.reduce(function(a,i){return a+BY[i.id].list*i.q;},0),t=o.pay==='transfer'?s*.75:s,shipTxt=o.ship==='custom'?'a acordar':'$[costo]';
  function row(dt,dd){return '<div><dt>'+dt+'</dt><dd>'+dd+'</dd><button class="copy" type="button" aria-label="Copiar '+dt+'">'+ico('i-copy')+'Copiar</button></div>';}
  var lines=o.items.map(function(i){return lineHTML(i,{mini:true,q:true});}).join('');
  var head=o.pay==='transfer'?'<h1 class="h1">Gracias, '+o.name+'. Recibimos tu pedido</h1><p class="muted lead">Pedido #[1234]. Lo despachamos cuando se acredite la transferencia. Te mandamos todo esto a '+(o.email||'tu email')+'.</p>':'<h1 class="h1">Listo, '+o.name+'. Pagaste '+fmt(s)+'</h1><p class="muted lead">Mercado Pago aprobó el pago en hasta 3 cuotas de '+fmt(s/3)+' sin interés. Pedido #[1234]. Despachamos el próximo día hábil.</p>';
  var bank=o.pay==='transfer'?'<section class="bank" aria-labelledby="bk-h"><h2 id="bk-h">Transferí para completar la compra</h2><div class="amount"><span>Monto exacto</span><b>'+fmt(t)+'</b></div><p class="small muted" style="margin-top:-4px">+ envío '+shipTxt+'. Tenés [x] horas; después el pedido se cancela y el stock se libera.</p><dl>'+row('Alias','[alias.sunnygafas]')+row('CBU','[0000000000000000000000]')+'<div><dt>Titular</dt><dd>[Nombre o razón social] · CUIT [xx-xxxxxxxx-x]</dd></div><div><dt>Banco</dt><dd>[Banco]</dd></div></dl><a class="btn btn-wa btn-block" href="'+WA+'">'+ico('i-chat')+'Mandar comprobante por WhatsApp</a><p class="small muted" style="text-align:center">O respondé el email de confirmación con el comprobante adjunto. [Circuito a confirmar]</p></section>':'';
  shell('<div class="in"><div class="ok-head"><span class="circ">'+ico('i-check')+'</span>'+head+'</div><div class="ok-grid"><div style="display:grid;gap:32px;grid-template-columns:minmax(0,1fr)">'+bank+
   '<section aria-labelledby="tl-h" style="display:grid;gap:16px"><h2 class="h3" id="tl-h">Qué sigue</h2><ol class="timeline"><li class="done"><span class="dot">'+ico('i-check')+'</span><span><b>Pedido recibido</b><small>Hoy</small></span></li>'+
    (o.pay==='transfer'?'<li class="now"><span class="dot"></span><span><b>Esperando tu transferencia</b><small>Confirmamos el pago en [plazo] y te avisamos por email.</small></span></li>':'<li class="done"><span class="dot">'+ico('i-check')+'</span><span><b>Pago aprobado</b><small>Mercado Pago</small></span></li>')+
    '<li><span class="dot"></span><span><b>Despachado</b><small>Te llega el código de seguimiento de Correo Argentino.</small></span></li><li><span class="dot"></span><span><b>Entregado</b><small>Llega con estuche y líquido limpiador.</small></span></li></ol></section>'+
   '<section class="whcard"><h3>Guardá tus datos para la próxima</h3><p class="small muted">Creá una contraseña y ves este pedido y su seguimiento desde Mi cuenta.</p><div class="inline"><div class="field"><label for="pw">Contraseña</label><input id="pw" type="password" autocomplete="new-password"></div><a class="btn btn-secondary" href="cuenta.html">Crear cuenta</a></div></section></div>'+
   '<aside class="sumcard" aria-label="Resumen del pedido"><h2>Tu pedido</h2><div class="lines-mini">'+lines+'</div><div class="sumrows"><div><span>Subtotal</span><span>'+fmt(s)+'</span></div>'+(o.pay==='transfer'?'<div class="disc"><span>Descuento transferencia (25%)</span><span>'+fmt(-s*.25)+'</span></div>':'')+'<div><span>Envío</span><span>'+shipTxt+'</span></div><div class="tot"><span>Total</span><span>'+fmt(t)+' + envío</span></div></div>'+
   '<div class="small muted" style="display:grid;gap:4px"><b style="color:var(--ink)">Entrega</b><span>'+(o.ship==='custom'?'Envío personalizado: te escribimos por WhatsApp.':o.addr)+'</span></div><a class="link" href="index.html">Volver a la tienda</a></aside></div></div>',{noNl:true});
  app.addEventListener('click',function(e){var c=e.target.closest('.bank .copy');if(!c||c.dataset.done)return;var dd=$('dd',c.parentNode).textContent;try{navigator.clipboard.writeText(dd).catch(function(){});}catch(_){}var old=c.innerHTML;c.dataset.done=1;c.innerHTML=ico('i-check')+'Copiado';c.style.cssText='background:var(--success);color:#fff;border-color:var(--success)';setTimeout(function(){c.innerHTML=old;c.style.cssText='';delete c.dataset.done;},2000);});
}

/* ---------- MI CUENTA ---------- */
function pageCuenta(){
  var logged=load('sg-logged',false),may=location.hash==='#mayorista';
  function th(img){return '<span><img class="'+fc(img).trim()+'" src="'+IMG+img+'.webp" alt=""></span>';}
  if(!logged&&!may){
    shell('<div class="in" style="max-width:480px;padding-block:32px 64px;display:grid;gap:16px"><h1 class="h1">Mi cuenta</h1><div class="tabs" role="tablist"><button role="tab" aria-selected="true" data-t="in">Ingresar</button><button role="tab" aria-selected="false" data-t="up">Crear cuenta</button></div>'+
     '<form class="js-login" novalidate style="display:grid;gap:16px"><div class="field"><label for="lem">Email</label><input id="lem" type="email" autocomplete="email" value="martina.gomez@gmail.com"></div><div class="field"><label for="lpw">Contraseña</label><input id="lpw" type="password" autocomplete="current-password" value="prototipo"></div><div class="field up-only" hidden><label for="lnm">Nombre</label><input id="lnm" autocomplete="given-name"></div><button class="btn btn-primary btn-block" type="submit">Ingresar</button><a class="link" href="#" style="justify-self:center">Me olvidé la contraseña</a><p class="small muted" style="text-align:center">Podés comprar sin cuenta. Con cuenta, ves tus pedidos y el seguimiento.</p></form>'+
     '<a class="link" href="cuenta.html#mayorista" style="justify-self:center">Tengo un negocio: solicitar cuenta mayorista</a></div>',{noNl:true});
    $$('[data-t]').forEach(function(b){b.addEventListener('click',function(){$$('[data-t]').forEach(function(x){x.setAttribute('aria-selected',x===b);});var up=b.dataset.t==='up';$('.up-only').hidden=!up;$('.js-login button[type=submit]').textContent=up?'Crear cuenta':'Ingresar';});});
    $('.js-login').addEventListener('submit',function(e){e.preventDefault();save('sg-logged',true);location.reload();});
    return;
  }
  var mayForm='<section class="whcard" id="may"><h3>Solicitar cuenta mayorista</h3><p class="small muted">Accedés a la lista de precios mayoristas. Revisamos la solicitud y te avisamos por email.</p><form class="js-may" novalidate style="display:grid;gap:14px"><div class="field"><label for="wn">Nombre del negocio</label><input id="wn"></div><div class="field"><label for="wc">CUIT</label><input id="wc" inputmode="numeric" placeholder="20-12345678-9"><p class="help"></p></div><div class="field"><label for="wci">Ciudad y provincia</label><input id="wci" placeholder="Córdoba, Córdoba"></div><button class="btn btn-primary" type="submit" style="justify-self:start">Enviar solicitud</button><p class="help">[Compra mínima y condiciones mayoristas a confirmar]</p></form></section>';
  if(!logged&&may){shell('<div class="in" style="max-width:560px;padding-block:32px 64px;display:grid;gap:16px"><nav class="crumbs"><a href="index.html">Inicio</a>'+ico('i-chev')+'<span aria-current="page">Venta mayorista</span></nav><h1 class="h1">Venta mayorista</h1>'+mayForm+'</div>',{noNl:true});bindMay();return;}
  shell('<div class="in"><nav class="crumbs" aria-label="Migas de pan"><a href="index.html">Inicio</a>'+ico('i-chev')+'<span aria-current="page">Mi cuenta</span></nav><h1 class="h1" style="padding-bottom:16px">Hola, Martina</h1>'+
  '<div class="acct"><nav class="acct-nav" aria-label="Mi cuenta"><a href="cuenta.html" aria-current="'+(may?'false':'page')+'">'+ico('i-box')+'Pedidos</a><a href="#">'+ico('i-pin')+'Direcciones</a><a href="#">'+ico('i-user')+'Mis datos</a><a href="cuenta.html#mayorista" aria-current="'+(may?'page':'false')+'">'+ico('i-store')+'Venta mayorista</a><a href="#" class="js-logout">'+ico('i-logout')+'Salir</a></nav>'+
  '<div class="acct-main" style="display:grid;gap:16px;min-width:0">'+(may?mayForm:'<h2 class="h2">Tus pedidos</h2>'+
   '<article class="order"><div class="top"><div><b>Pedido #[1234]</b><small>14 de noviembre de 2026 · $24.750 + envío</small></div><span class="status st-wait">'+ico('i-bank')+'Esperando transferencia</span></div><div class="thumbs">'+th('glow-negro')+th('cadena-gold')+'</div><div class="bot"><span class="muted">Glow · Negro, Cadena · Gold</span><div class="btns"><a class="btn btn-primary" href="confirmacion.html">Ver datos para transferir</a></div></div><p class="regret">¿Te arrepentiste? Podés cancelar sin costo hasta 10 días después de recibirlo. <a href="pendiente.html#arrepentimiento">Arrepentirme de esta compra</a></p></article>'+
   '<article class="order"><div class="top"><div><b>Pedido #[1198]</b><small>2 de noviembre de 2026 · $40.500</small></div><span class="status st-ship">'+ico('i-truck')+'Despachado</span></div><div class="thumbs">'+th('gala-carey')+'</div><div class="bot"><span class="muted">Gala · Carey · Correo Argentino [código]</span><div class="btns"><a class="btn btn-secondary" href="https://www.correoargentino.com.ar/formularios/e-commerce" target="_blank" rel="noopener">Seguir envío</a></div></div></article>'+
   '<article class="order"><div class="top"><div><b>Pedido #[1103]</b><small>18 de septiembre de 2026 · $20.250</small></div><span class="status st-done">'+ico('i-check')+'Entregado</span></div><div class="thumbs">'+th('braga-verde')+'</div><div class="bot"><span class="muted">Braga · Verde</span><div class="btns"><a class="btn btn-secondary" href="producto.html#braga">Ver producto</a></div></div></article>'+
   '<div class="acct-cols"><section class="whcard"><h3>Venta mayorista</h3><p class="small muted">¿Tenés una óptica o un local? Pedí acceso a la lista de precios mayoristas.</p><a class="btn btn-secondary" href="cuenta.html#mayorista" style="justify-self:start">Solicitar cuenta mayorista</a></section><section class="whcard"><h3>Dirección principal</h3><p class="small muted">Av. Hipólito Yrigoyen 450, 3° B<br>5000 Córdoba, Córdoba</p><a class="link" href="#" style="min-height:32px">Editar dirección</a></section></div>')+
  '</div></div><div style="height:48px"></div></div>',{noNl:true});
  $('.js-logout').addEventListener('click',function(e){e.preventDefault();save('sg-logged',false);location.href='cuenta.html';});
  if(may)bindMay();
  window.addEventListener('hashchange',function(){location.reload();});
  function bindMay(){$('.js-may').addEventListener('submit',function(e){e.preventDefault();var c=$('#wc'),f=c.parentNode,h=$('.help',f),v=c.value.replace(/\D/g,'');
    if(v.length!==11){f.classList.add('err');c.setAttribute('aria-invalid','true');h.innerHTML=ico('i-alert','s')+'El CUIT tiene 11 números, por ejemplo 20-12345678-9.';c.focus();return;}
    e.target.innerHTML='<p style="display:flex;gap:8px;color:var(--success);font-weight:600">'+ico('i-check')+'Recibimos tu solicitud. Te escribimos a tu email cuando la revisemos.</p>';});}
}

/* ---------- PENDIENTE (etapa 4) ---------- */
function pagePendiente(){
  var k=(location.hash||'#').slice(1),names={'clip-on':'Clip-on 2 en 1','quienes-somos':'Quiénes somos','ayuda':'Ayuda y preguntas frecuentes','envios':'Envíos','pagos':'Pagos','cambios':'Cambios y devoluciones','cuidado':'Cuidado de tus gafas','guia-de-medidas':'Guía de medidas','blog':'Blog','contacto':'Contacto','terminos':'Términos y condiciones','privacidad':'Política de privacidad','arrepentimiento':'Botón de arrepentimiento'};
  var n=names[k]||'Esta página';
  document.body.classList.add('brand');app.classList.add('brand');
  shell('<div class="in" style="padding-block:64px 96px;display:grid;gap:16px;max-width:720px"><span class="tbv">Se diseña en la etapa 4</span><h1 class="h1">'+n+'</h1><p class="lead muted">Esta pantalla todavía no está diseñada. La etapa 4 suma las institucionales, Ayuda/FAQ, Contacto con venta mayorista, el blog y la página 404.</p><div style="display:flex;gap:12px;flex-wrap:wrap"><a class="btn btn-primary" href="index.html">Volver al inicio</a><a class="btn btn-secondary" href="listado.html#gafas-de-sol">Ver gafas de sol</a></div></div>');
  window.addEventListener('hashchange',function(){location.reload();});
}

/* ---------- arranque ---------- */
({home:pageHome,listado:pageListado,producto:pageProducto,carrito:pageCarrito,checkout:pageCheckout,confirmacion:pageConfirmacion,cuenta:pageCuenta,pendiente:pagePendiente}[page]||pageHome)();
bindMega();annRotate();
function openFootCols(){if(innerWidth>=1000)$$('.fcols details').forEach(function(d){d.open=true;});}
openFootCols();addEventListener('resize',openFootCols);
var sb=$('.stickybar'),ctas=$('.buy .ctas');
if(sb&&ctas&&'IntersectionObserver' in window){document.body.classList.add('has-sticky');sb.classList.add('away');new IntersectionObserver(function(es){var aw=es[0].isIntersecting||es[0].boundingClientRect.top>innerHeight;sb.classList.toggle('away',aw);document.body.classList.toggle('sticky-on',!aw);}).observe(ctas);}
})();
