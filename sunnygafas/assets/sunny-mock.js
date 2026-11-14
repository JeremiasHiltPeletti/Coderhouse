/* Sunnygafas · piezas compartidas de los mockups (header, footer, precios). Desde la etapa 3. */
(function(w){
'use strict';
var IMG='assets/productos/';
function fmt(n){var neg=n<0;n=Math.abs(n);return (neg?'−':'')+'$'+n.toLocaleString('es-AR',{minimumFractionDigits:(n%1?2:0),maximumFractionDigits:2});}
function r2(n){return Math.round(n*100)/100;}
function ico(id,cls){return '<svg class="ico'+(cls?' '+cls:'')+'" aria-hidden="true"><use href="#'+id+'"/></svg>';}
function priceHTML(list,cls){
  var t=r2(list*0.75),q=r2(list/3),tax=Math.round(list/1.21);
  return '<div class="price '+(cls||'')+'"><p class="p-transfer"><b>'+fmt(t)+'</b>con transferencia</p><p class="p-list">'+fmt(list)+' o 3 × '+fmt(q)+' sin interés</p><p class="p-tax">Precio sin imp. nacionales: '+fmt(tax)+'</p></div>';
}
function headerHTML(o){
  o=o||{};
  return '<a class="skip" href="#">Ir al contenido</a>'+
  '<div class="announce" role="region" aria-label="Beneficios"><span class="m-only">25% de descuento con transferencia</span><span class="d-only">25% de descuento con transferencia</span><span class="d-only sep">·</span><span class="d-only">3 cuotas sin interés</span><span class="d-only sep">·</span><span class="d-only">Despachamos todos los días hábiles</span></div>'+
  '<header class="hdr"><div class="hdr-row">'+
   '<div class="side l"><button class="icobtn" aria-label="Abrir menú">'+ico('i-menu')+'</button><button class="icobtn" aria-label="Buscar">'+ico('i-search')+'</button></div>'+
   '<a class="logo" href="#" aria-label="Sunnygafas, inicio"><img src="assets/isotipo-sunnygafas.png" alt="" width="40" height="32"><span>Sunnygafas</span></a>'+
   '<nav class="nav" aria-label="Principal"><a href="#">Gafas de sol'+ico('i-down','s')+'</a><a href="#">Polarizadas</a><a href="#">Armazones</a><a href="#">Clip-on 2 en 1</a><a href="#">Accesorios</a></nav>'+
   '<div class="side r"><label class="search">'+ico('i-search')+'<span>Buscar modelo o color</span></label><button class="icobtn" aria-label="Mi cuenta">'+ico('i-user')+'</button><button class="icobtn" aria-label="Carrito, '+(o.count==null?2:o.count)+' productos">'+ico('i-bag')+(o.count===0?'':'<span class="count">'+(o.count==null?2:o.count)+'</span>')+'</button></div>'+
  '</div></header>';
}
function footerHTML(o){
  o=o||{};
  var nl=o.noNewsletter?'':'<section class="sec prefoot" aria-label="Newsletter"><div class="in nlgrid"><div style="display:grid;gap:8px"><h2 class="h2">Te avisamos cuando entran modelos</h2><p class="muted">[Incentivo a definir]. Un email por tanda nueva, nada más.</p></div>'+
   '<form class="nlform" onsubmit="event.preventDefault()"><div class="field"><label>Email</label><input type="email" placeholder="tunombre@gmail.com" autocomplete="email"><p class="help">Te podés dar de baja desde cualquier email.</p></div><button class="btn btn-primary" type="submit">Suscribirme</button></form></div></section>';
  return nl+'<footer class="foot"><div class="in"><div class="foot-top"><div><a class="logo" href="#"><img src="assets/isotipo-sunnygafas.png" alt="" width="40" height="32"><span>Sunnygafas</span></a><p class="foot-intro">Gafas de sol, polarizadas, armazones y cadenas. Venta online desde [ciudad], sin local a la calle.</p>'+
   '<div class="contact"><a class="btn btn-wa" href="#">'+ico('i-chat')+'Escribinos por WhatsApp</a><a href="#">'+ico('i-chat')+'[+54 9 xx xxxx-xxxx]</a><a href="#">'+ico('i-ig')+'@sunnygafas</a><a href="#">'+ico('i-mail')+'sunny.gafas.ch@gmail.com</a></div></div>'+
   '<div class="fcols">'+
    '<details open><summary>Comprar'+ico('i-down')+'</summary><ul><li><a href="#">Gafas de sol</a></li><li><a href="#">Polarizadas</a></li><li><a href="#">Armazones</a></li><li><a href="#">Clip-on 2 en 1</a></li><li><a href="#">Accesorios</a></li></ul></details>'+
    '<details><summary>Ayuda'+ico('i-down')+'</summary><ul><li><a href="#">Envíos</a></li><li><a href="#">Pagos</a></li><li><a href="#">Cambios y devoluciones</a></li><li><a href="#">Cuidado de tus gafas</a></li><li><a href="#">Guía de medidas</a></li><li><a href="#">Preguntas frecuentes</a></li></ul></details>'+
    '<details><summary>Sunnygafas'+ico('i-down')+'</summary><ul><li><a href="#">Quiénes somos</a></li><li><a href="#">Venta mayorista</a></li><li><a href="#">Blog</a></li><li><a href="#">Contacto</a></li><li><a href="#">Mi cuenta</a></li></ul></details>'+
   '</div></div>'+
   '<div class="foot-mid"><div><h4>Envíos</h4><p class="foot-ship">Correo Argentino a todo el país. Envío personalizado: a acordar por WhatsApp.</p></div><div><h4>Medios de pago</h4><div class="pay"><span>Visa</span><span>Mastercard</span><span>American Express</span><span>Naranja</span><span>Cabal</span><span>Maestro</span><span>Mercado Pago</span><span>Transferencia</span></div></div></div>'+
   '<div class="legal"><a class="btn-regret" href="#">Botón de arrepentimiento</a><div class="links"><a href="#">Términos y condiciones</a><a href="#">Privacidad</a><a href="#">Cambios y devoluciones</a><a href="#">Defensa del Consumidor</a></div><p>[Razón social] · CUIT [xx-xxxxxxxx-x] · © 2026 Sunnygafas</p></div>'+
  '</div></footer>';
}
/* Escalado de frames desktop: el frame mide 1440 en CSS y se reduce con zoom al ancho disponible. */
function fitFrames(){
  document.querySelectorAll('.dframe .fcols details').forEach(function(d){d.open=true;});
  document.querySelectorAll('.dframe').forEach(function(f){var s=f.firstElementChild;s.style.zoom=f.classList.contains('real')?1:Math.min(1,f.clientWidth/1440);});
}
function bindZoomButtons(){
  document.querySelectorAll('[data-real]').forEach(function(b){b.addEventListener('click',function(){var f=document.getElementById(b.dataset.real);var on=f.classList.toggle('real');b.textContent=on?'Volver a la vista escalada':'Ver a 1440 reales';fitFrames();});});
  window.addEventListener('resize',fitFrames);
}
w.SG={IMG:IMG,fmt:fmt,r2:r2,ico:ico,priceHTML:priceHTML,headerHTML:headerHTML,footerHTML:footerHTML,fitFrames:fitFrames,bindZoomButtons:bindZoomButtons};
})(window);
