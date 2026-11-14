/* ---------- ETAPA 4: institucionales, ayuda, contacto, blog, legales, arrepentimiento y 404 ---------- */
function crumbs(items){return '<nav class="crumbs" aria-label="Migas de pan"><a href="index.html">Inicio</a>'+items.map(function(x,i){return ico('i-chev')+(i===items.length-1?'<span aria-current="page">'+x[0]+'</span>':'<a href="'+x[1]+'">'+x[0]+'</a>');}).join('')+'</nav>';}
function brandPage(){document.body.classList.add('brand');app.classList.add('brand');}
function hashTo(){var h=location.hash.slice(1);if(!h)return;var el=document.getElementById(h);if(el)setTimeout(function(){el.scrollIntoView({block:'start'});},50);}
function bindForm(form,rules,onOk){
  var helps={};$$('.field',form).forEach(function(f){var i=$('input,select,textarea',f),h=$('.help',f);if(i&&h)helps[i.id]=h.innerHTML;});
  function check(i){var r=rules[i.id];if(!r)return true;var f=i.closest('.field'),h=$('.help',f),ok=r[0].test(i.value.trim());f.classList.toggle('err',!ok);
    if(!ok){i.setAttribute('aria-invalid','true');h.innerHTML=ico('i-alert','s')+r[1];}else{i.removeAttribute('aria-invalid');h.innerHTML=helps[i.id]||'';}return ok;}
  form.addEventListener('focusout',function(e){if(e.target.matches('input,textarea')&&e.target.value)check(e.target);});
  form.addEventListener('submit',function(e){e.preventDefault();var bad=null;Object.keys(rules).forEach(function(id){var i=$('#'+id,form);if(i&&!check(i)&&!bad)bad=i;});if(bad){bad.focus();return;}
    var b=$('button[type=submit]',form),t=b.textContent;b.disabled=true;b.textContent='Enviando…';setTimeout(function(){onOk(form);},700);});
}
var RE_EMAIL=[/^[^@\s]+@[^@\s]+\.[^@\s]+$/,'Revisá el email: le falta el dominio, por ejemplo @gmail.com.'];
function fld(id,label,attrs,help,cls){return '<div class="field '+(cls||'')+'"><label for="'+id+'">'+label+'</label><input id="'+id+'" '+(attrs||'')+'><p class="help">'+(help||'')+'</p></div>';}
function area(id,label,help,cls){return '<div class="field '+(cls||'')+'"><label for="'+id+'">'+label+'</label><textarea id="'+id+'" rows="5"></textarea><p class="help">'+(help||'')+'</p></div>';}
function sel(id,label,opts,cls){return '<div class="field '+(cls||'')+'"><label for="'+id+'">'+label+'</label><select id="'+id+'">'+opts.map(function(o){return '<option>'+o+'</option>';}).join('')+'</select><p class="help"></p></div>';}
function okMsg(t,sub){return '<div class="okbox" role="status">'+'<span class="circ">'+ico('i-check')+'</span><div><p style="font-weight:700">'+t+'</p><p class="small muted">'+sub+'</p></div></div>';}

/* Quiénes somos (Persuade, página de marca) */
function pageNosotros(){
  brandPage();
  shell('<section class="inst-hero"><div class="in inst-grid"><div class="inst-copy">'+crumbs([['Quiénes somos']])+'<h1 class="h-disp">Gafas con aval de óptico, desde [ciudad] a todo el país</h1><p class="lead muted">[Nombre] arrancó Sunnygafas en [año] vendiendo por Instagram. Hoy despachamos todos los días hábiles y cada modelo entra al catálogo con el visto bueno de [nombre del óptico].</p><a class="btn btn-primary" href="listado.html#gafas-de-sol" style="justify-self:start">Ver gafas de sol</a></div>'+
   '<div class="inst-photo"><div class="ph ph-sol" role="img" aria-label="Foto pendiente: la fundadora armando pedidos"><div class="ph-tag"><span>Foto propia · [Nombre] armando pedidos con estuche y líquido</span></div></div></div></div></section>'+
  '<section class="sec"><div class="in"><div class="sec-head"><h2 class="h2">Cómo llega un modelo a tu casa</h2></div><ol class="steps3">'+
   '<li><span class="n">1</span><h3 class="h3">Lo elegimos</h3><p class="muted">[Cómo eligen los modelos: tendencias, pedidos de clientas, proveedores.]</p></li>'+
   '<li><span class="n">2</span><h3 class="h3">Lo revisa el óptico</h3><p class="muted">[Nombre del óptico] controla el filtro UV400 y [qué más revisa] antes de publicarlo.</p></li>'+
   '<li><span class="n">3</span><h3 class="h3">Sale el mismo día hábil</h3><p class="muted">Va con estuche y líquido limpiador, por Correo Argentino o envío a acordar.</p></li></ol></div></section>'+
  '<section class="sec band-ink"><div class="in optico"><div>'+raysSVG(9,120,64)+'</div><div style="display:grid;gap:16px"><h2 class="h2">Quién avala las gafas</h2><p class="lead" style="color:var(--arena-50)">[Nombre y apellido], óptico/a, M.N. [n.º].</p><p class="muted">[Dos líneas sobre su trayectoria y qué revisa en cada modelo. Texto a escribir con el óptico.]</p><a href="ayuda.html#proteccion" style="color:var(--arena-50);font-weight:600">Qué significa UV400</a></div></div></section>'+
  '<section class="sec band-mar"><div class="in findus"><div style="display:grid;gap:12px"><h2 class="h2">Dónde encontrarnos</h2><p class="muted lead">No tenemos local a la calle. Vendemos online y respondemos por WhatsApp e Instagram.</p></div>'+
   '<div class="findlist"><a href="'+WA+'">'+ico('i-chat')+'<span><b>WhatsApp</b><small>[+54 9 xx xxxx-xxxx] · [horario]</small></span></a><a href="https://instagram.com/sunnygafas" target="_blank" rel="noopener">'+ico('i-ig')+'<span><b>Instagram</b><small>@sunnygafas</small></span></a><a href="contacto.html">'+ico('i-mail')+'<span><b>Email</b><small>sunny.gafas.ch@gmail.com</small></span></a></div></div></section>');
}

/* Ayuda y FAQ (Read) */
var FAQ=[
 ['envios','Envíos',[
  ['¿Hacen envíos a todo el país?','Sí. Enviamos por Correo Argentino a domicilio o a sucursal, a cualquier punto del país.'],
  ['¿Cuánto tarda en llegar?','Despachamos todos los días hábiles. Correo Argentino tarda [x a y] días hábiles según el destino.'],
  ['¿Cuánto cuesta el envío?','Lo calculás con tu código postal en la ficha del producto o en el carrito. [Envío gratis desde $x, si aplica.]'],
  ['¿Cómo sigo mi pedido?','Cuando sale, te mandamos el código de seguimiento por email. También lo ves en Mi cuenta.'],
  ['¿Puedo retirar en persona?','No tenemos local a la calle. Si necesitás otra forma de entrega, coordinamos un envío personalizado por WhatsApp.']]],
 ['pagos','Pagos',[
  ['¿Qué descuento tengo pagando con transferencia?','25% sobre el precio de lista, pagando con transferencia o efectivo. Lo ves aplicado en el checkout al elegir ese medio.'],
  ['¿Puedo pagar en cuotas?','Sí, hasta 3 cuotas sin interés con Visa, Mastercard, American Express, Naranja y Cabal, por Mercado Pago. Con Maestro y débito pagás en un pago.'],
  ['¿Cuánto tiempo tengo para transferir?','[x] horas desde que confirmás la compra. Después el pedido se cancela y el stock se libera.'],
  ['¿Cómo mando el comprobante?','Por WhatsApp o respondiendo el email de confirmación con el comprobante adjunto.'],
  ['¿Qué es el "precio sin impuestos nacionales"?','Es el precio sin el IVA y otros impuestos nacionales incluidos. Lo mostramos en cada producto por el Régimen de Transparencia Fiscal al Consumidor (Ley 27.743).']]],
 ['cambios','Cambios y devoluciones',[
  ['¿Puedo cambiar mis gafas?','Sí, dentro de los [plazo] días de recibirlas, sin uso y con su estuche. Escribinos por WhatsApp y te decimos cómo enviarlas.'],
  ['¿Quién paga el envío del cambio?','[A confirmar con la marca.]'],
  ['¿Me puedo arrepentir de la compra?','Sí. Tenés 10 días corridos desde que recibís el producto para cancelar la compra sin costo ni explicación, con el botón de arrepentimiento. Te devolvemos el dinero por el mismo medio de pago.'],
  ['¿Y si llegan con una falla?','Mandanos una foto por WhatsApp dentro de los [x] días de recibirlas y lo resolvemos. [Garantía a confirmar.]']]],
 ['cuidado','Cuidado',[
  ['¿Cómo las limpio?','Con el líquido que viene de regalo y un paño de microfibra. La remera, el papel o las servilletas rayan el lente.'],
  ['¿Dónde las guardo?','En el estuche. No las dejes al sol dentro del auto: el calor deforma el marco. Tampoco las apoyes sobre los lentes.'],
  ['¿Puedo usar las polarizadas para manejar?','Sí: cortan el reflejo del asfalto y del parabrisas. Algunas pantallas del auto o del celular pueden verse con manchas; es normal en lentes polarizados.']]],
 ['proteccion','Protección',[
  ['¿Qué significa UV400?','Que el lente bloquea la radiación ultravioleta hasta 400 nanómetros, lo que incluye los rayos UVA y UVB. Todas nuestras gafas tienen filtro UV400.'],
  ['¿Un lente claro protege menos que uno oscuro?','No. La protección la da el filtro UV400, no el color. Un lente claro con UV400 protege igual que uno oscuro.'],
  ['¿Quién avala las gafas?','[Nombre y apellido], óptico/a, M.N. [n.º]. Revisa cada modelo antes de que entre al catálogo.']]],
 ['mayorista','Venta mayorista',[
  ['¿Venden por mayor?','Sí. Completá la solicitud de cuenta mayorista y te mandamos la lista de precios cuando la aprobemos. [Compra mínima a confirmar.]']]]
];
function pageAyuda(){
  var nav=FAQ.map(function(s){return '<a href="#'+s[0]+'">'+s[1]+'</a>';}).join('')+'<a href="#medidas">Guía de medidas</a>';
  var secs=FAQ.map(function(s){return '<section class="faqsec" id="'+s[0]+'" aria-labelledby="h-'+s[0]+'"><h2 class="h2" id="h-'+s[0]+'">'+s[1]+'</h2><div class="acc">'+s[2].map(function(q,i){return '<details'+(i===0?' open':'')+'><summary>'+q[0]+ico('i-plus')+'</summary><div class="body"><p>'+q[1].replace('botón de arrepentimiento','<a href="arrepentimiento.html" style="color:var(--ink)">botón de arrepentimiento</a>').replace('solicitud de cuenta mayorista','<a href="contacto.html#mayorista" style="color:var(--ink)">solicitud de cuenta mayorista</a>')+'</p></div></details>';}).join('')+'</div></section>';}).join('');
  var medidas='<section class="faqsec" id="medidas" aria-labelledby="h-med"><h2 class="h2" id="h-med">Guía de medidas</h2><p class="muted" style="max-width:62ch">Cada armazón trae tres números en la parte interna de la varilla, por ejemplo <b style="color:var(--ink)">52□18-140</b>. Son milímetros.</p>'+
   '<div class="medgrid"><svg class="measure" viewBox="0 0 520 260" fill="none" stroke="currentColor" stroke-width="1.5" role="img" aria-label="Dibujo de un armazón con sus cuatro medidas"><ellipse cx="150" cy="120" rx="90" ry="58"/><ellipse cx="370" cy="120" rx="90" ry="58"/><path d="M240 108c10-14 30-14 40 0"/><path d="M60 104H40M460 104h20"/><g stroke="#1D5A60" stroke-width="1"><path d="M40 40H480M40 34v12M480 34v12"/><path d="M60 205H240M60 199v12M240 199v12"/><path d="M240 175H280M240 169v12M280 169v12"/><path d="M40 250H200M40 244v12M200 244v12"/></g><text x="260" y="30" text-anchor="middle">Ancho total</text><text x="150" y="226" text-anchor="middle">Lente</text><text x="260" y="196" text-anchor="middle">Puente</text><path d="M40 238h150c8 0 14-4 18-10" stroke-dasharray="3 4" stroke-width="1"/><text x="230" y="254">Varilla (vista lateral)</text></svg>'+
   '<div class="specs"><table><caption class="sr">Qué significa cada número</caption><tbody><tr><th scope="row">52 · Lente</th><td>Ancho de cada lente</td></tr><tr><th scope="row">18 · Puente</th><td>Espacio entre los lentes, sobre la nariz</td></tr><tr><th scope="row">140 · Varilla</th><td>Largo de la patilla hasta la oreja</td></tr><tr><th scope="row">Ancho total</th><td>De punta a punta del frente; se mide con regla</td></tr></tbody></table></div></div>'+
   '<p class="muted" style="max-width:62ch">Compará con unos anteojos que te queden cómodos. Con 2 o 3 mm de diferencia, el calce va a ser parecido. Las medidas de cada modelo están en su ficha.</p></section>';
  shell('<div class="in"><div class="help-head">'+crumbs([['Ayuda']])+'<h1 class="h1">Ayuda</h1><p class="lead muted">Envíos, pagos, cambios y cuidado. Si no encontrás tu respuesta, escribinos por WhatsApp.</p></div>'+
   '<div class="helpgrid"><nav class="helpnav" aria-label="Temas de ayuda">'+nav+'</nav><div class="helpbody">'+secs+medidas+
   '<div class="helpcta"><h2 class="h3">¿Te quedó una duda?</h2><p class="muted">Respondemos por WhatsApp [horario].</p><a class="btn btn-wa" href="'+WA+'">'+ico('i-chat')+'Escribinos por WhatsApp</a></div></div></div></div>');
  hashTo();
}

/* Contacto + venta mayorista */
function pageContacto(){
  shell('<div class="in"><div class="help-head">'+crumbs([['Contacto']])+'<h1 class="h1">Contacto</h1><p class="lead muted">La forma más rápida es WhatsApp. Respondemos [días y horario].</p></div>'+
  '<div class="contgrid"><div class="contopts"><a class="btn btn-wa btn-block" href="'+WA+'">'+ico('i-chat')+'Escribinos por WhatsApp</a><div class="findlist light"><a href="https://instagram.com/sunnygafas" target="_blank" rel="noopener">'+ico('i-ig')+'<span><b>Instagram</b><small>@sunnygafas</small></span></a><a href="#">'+ico('i-mail')+'<span><b>Email</b><small>sunny.gafas.ch@gmail.com</small></span></a><a href="ayuda.html">'+ico('i-box')+'<span><b>Ayuda</b><small>Envíos, pagos, cambios y cuidado</small></span></a></div><p class="small muted">No tenemos local a la calle. [Razón social] · CUIT [xx-xxxxxxxx-x].</p></div>'+
   '<form class="contform js-contact" novalidate><h2 class="h3">Dejanos tu mensaje</h2><div class="fgrid">'+fld('c-nom','Nombre','autocomplete="name"','','')+fld('c-em','Email','type="email" autocomplete="email"','Te respondemos a este email.','')+
    sel('c-mot','Motivo',['Consulta por un modelo','Estado de mi pedido','Cambios y devoluciones','Otro'],'')+fld('c-ped','Número de pedido <span class="muted" style="font-weight:400">(opcional)</span>','inputmode="numeric"','Lo encontrás en el email de confirmación.','')+area('c-msg','Mensaje','','full')+'</div><button class="btn btn-primary" type="submit">Enviar mensaje</button></form></div></div>'+
  '<section class="sec prefoot" id="mayorista" aria-labelledby="h-may" style="margin-top:64px"><div class="in maygrid"><div style="display:grid;gap:12px;align-content:start"><h2 class="h2" id="h-may">Venta mayorista</h2><p class="muted">Para ópticas, locales y revendedoras. Completá la solicitud: la revisamos y, si se aprueba, te mandamos la lista de precios mayoristas por email.</p><ul class="maylist"><li>'+ico('i-check')+'Compra mínima: [a confirmar]</li><li>'+ico('i-check')+'Lista de precios: [a confirmar]</li><li>'+ico('i-check')+'Envíos a todo el país por Correo Argentino</li></ul></div>'+
   '<form class="contform js-may" novalidate style="background:var(--white)"><div class="fgrid">'+fld('m-neg','Nombre del negocio','autocomplete="organization"','','full')+fld('m-cuit','CUIT','inputmode="numeric" placeholder="20-12345678-9"','','')+sel('m-rub','Rubro',['Óptica','Local de ropa o accesorios','Revendedora online','Otro'],'')+fld('m-ciu','Ciudad y provincia','placeholder="Córdoba, Córdoba"','','')+fld('m-ig','Instagram o web <span class="muted" style="font-weight:400">(opcional)</span>','placeholder="@tunegocio"','','')+fld('m-em','Email','type="email" autocomplete="email"','','')+fld('m-tel','WhatsApp','type="tel" inputmode="tel" autocomplete="tel"','','')+'</div><button class="btn btn-primary" type="submit">Enviar solicitud</button></form></div></section>',{noNl:true});
  bindForm($('.js-contact'),{'c-nom':[/\S/,'Completá tu nombre.'],'c-em':RE_EMAIL,'c-msg':[/\S{3,}/,'Contanos en qué te ayudamos.']},function(f){f.innerHTML=okMsg('Recibimos tu mensaje','Te respondemos por email en [plazo]. Si es urgente, escribinos por WhatsApp.');});
  bindForm($('.js-may'),{'m-neg':[/\S/,'Completá el nombre del negocio.'],'m-cuit':[/^\d{2}-?\d{8}-?\d$/,'El CUIT tiene 11 números, por ejemplo 20-12345678-9.'],'m-ciu':[/\S/,'Completá ciudad y provincia.'],'m-em':RE_EMAIL,'m-tel':[/^[\d\s()+-]{8,}$/,'Sumá la característica y el número, por ejemplo 351 555 1234.']},function(f){f.innerHTML=okMsg('Recibimos tu solicitud','La revisamos y te escribimos por email. [Plazo de respuesta a confirmar.]');});
  hashTo();
}

/* Blog (Read) */
var POSTS=[
 {s:'que-es-uv400',t:'Qué significa UV400 y cómo saber si tus gafas protegen',c:'Protección',m:5,img:'roxy-gris',x:'UV400 es lo que separa unas gafas de sol de un vidrio oscuro. Qué filtra, por qué el color no importa y cómo comprobarlo.'},
 {s:'polarizadas-o-comunes',t:'¿Polarizadas o comunes? Cuál te conviene para manejar, la playa o la ciudad',c:'Guía',m:4,img:'boston-brown',x:'Las dos filtran UV400. Cuándo vale la pena pagar por cortar el reflejo y cuándo no.'},
 {s:'anteojos-segun-forma-de-cara',t:'Qué anteojos de sol te quedan según la forma de tu cara',c:'Guía',m:6,img:'gala-carey',x:'Redondas, cuadradas, cat eye o aviador: cómo elegir la forma sin probártelas.'},
 {s:'medidas-de-anteojos',t:'Cómo leer los números de la varilla: 52□18-140',c:'Guía',m:3,img:'dallas-marron',x:'Los tres números de tus anteojos te dicen si un modelo nuevo te va a calzar.'},
 {s:'como-limpiar-anteojos',t:'Cómo limpiar tus anteojos sin rayarlos',c:'Cuidado',m:3,img:'cadena-beige',x:'Qué usar, qué evitar y cómo guardarlos para que el lente dure.'},
 {s:'que-son-los-clip-on',t:'Clip-on 2 en 1: qué son y para quién sirven',c:'Guía',m:4,img:'nova',x:'Un armazón para tu receta y un clip de sol encima. Ventajas y cómo elegir el tuyo.'}
];
function postCard(p,big){return '<a class="pcard'+(big?' big':'')+'" href="articulo.html#'+p.s+'"><span class="pimg"><img class="'+fc(p.img).trim()+'" src="'+IMG+p.img+'.webp" alt="" loading="lazy"></span><span class="pmeta">'+p.c+' · '+p.m+' min de lectura</span><span class="ptitle">'+p.t+'</span><span class="pex">'+p.x+'</span></a>';}
function pageBlog(){
  shell('<div class="in"><div class="help-head">'+crumbs([['Blog']])+'<h1 class="h1">Blog</h1><p class="lead muted">Guías cortas para elegir, medir y cuidar tus gafas. Revisadas por [nombre del óptico].</p></div>'+
   '<div class="blogfilters" role="group" aria-label="Temas"><button class="chip" aria-pressed="true" data-c="">Todo</button><button class="chip" aria-pressed="false" data-c="Guía">Guías</button><button class="chip" aria-pressed="false" data-c="Protección">Protección</button><button class="chip" aria-pressed="false" data-c="Cuidado">Cuidado</button></div>'+
   '<div class="bloggrid"></div><div style="height:64px"></div></div>');
  function render(c){var l=POSTS.filter(function(p){return !c||p.c===c;});$('.bloggrid').innerHTML=l.map(function(p,i){return postCard(p,i===0&&!c);}).join('');}
  $$('[data-c]').forEach(function(b){b.addEventListener('click',function(){$$('[data-c]').forEach(function(x){x.setAttribute('aria-pressed',x===b);});render(b.dataset.c);});});
  render('');
}
function pageArticulo(){
  var s=location.hash.slice(1)||'que-es-uv400',p=POSTS.filter(function(x){return x.s===s;})[0]||POSTS[0],full=p.s==='que-es-uv400';
  document.title=p.t+' · Sunnygafas';
  var body=full?
   '<p class="alead">UV400 es la etiqueta que dice cuánto filtra un lente: bloquea la radiación ultravioleta hasta 400 nanómetros, lo que incluye los rayos UVA y UVB. Es lo que separa unas gafas de sol de un vidrio oscuro.</p>'+
   '<h2 id="que-filtra">Qué filtra exactamente</h2><p>La luz del sol trae radiación ultravioleta que no vemos. La que llega a la superficie se divide en dos: los rayos UVB, de 280 a 315 nanómetros, y los UVA, de 315 a 400. Un lente con filtro UV400 bloquea todo lo que está por debajo de los 400 nanómetros, así que cubre los dos.</p>'+
   '<h2 id="color">Lo oscuro no es lo que protege</h2><p>El tono del lente reduce la luz visible, la que te encandila. La protección contra el ultravioleta depende de un filtro aparte. Por eso un lente claro con UV400 protege igual que uno oscuro.</p><p>Un lente oscuro sin filtro puede ser peor que no usar nada: con menos luz, la pupila se abre y deja entrar más radiación.</p>'+
   '<div class="callout"><b>En corto:</b> fijate que diga UV400 o "100% UV". El color elegilo por gusto o por cuánta luz te molesta.</div>'+
   '<h2 id="como-saber">Cómo saber si tus gafas tienen UV400</h2><ol><li>Buscá la inscripción en la parte interna de la varilla o en una etiqueta del lente.</li><li>Preguntale a quien te las vende qué filtro tienen y quién lo controla.</li><li>En una óptica pueden medir el filtro con un equipo específico. [Confirmar con el óptico qué equipo usan.]</li></ol>'+
   '<h2 id="polarizadas">¿Y las polarizadas?</h2><p>Polarizado y UV400 son cosas distintas. La polarización corta el reflejo del agua, la nieve y el asfalto; el UV400 filtra la radiación. Nuestras polarizadas tienen las dos cosas. <a href="articulo.html#polarizadas-o-comunes">Cuándo conviene cada una</a>.</p>'+
   '<h2 id="sunnygafas">En Sunnygafas</h2><p>Todos los modelos tienen filtro UV400 y están avalados por [nombre del óptico], M.N. [n.º]. Vienen con estuche y líquido limpiador.</p>':
   '<p class="alead">'+p.x+'</p><div class="callout"><b>Borrador:</b> artículo planificado en la etapa 4. El texto completo se escribe con el óptico. Estructura propuesta en la tabla SEO.</div>';
  var toc=full?'<nav class="toc-a" aria-label="En este artículo"><p class="small" style="font-weight:700">En este artículo</p><a href="#que-filtra">Qué filtra exactamente</a><a href="#color">Lo oscuro no es lo que protege</a><a href="#como-saber">Cómo saber si tienen UV400</a><a href="#polarizadas">¿Y las polarizadas?</a><a href="#sunnygafas">En Sunnygafas</a></nav>':'';
  var rel=POSTS.filter(function(x){return x.s!==p.s;}).slice(0,3);
  shell('<article class="in art">'+crumbs([['Blog','blog.html'],[p.c]])+'<header class="arthead"><p class="pmeta">'+p.c+' · '+p.m+' min de lectura</p><h1 class="h1">'+p.t+'</h1><p class="small muted">Revisado por [nombre del óptico], M.N. [n.º] · Actualizado el [fecha]</p></header>'+
   '<div class="artimg"><img class="'+fc(p.img).trim()+'" src="'+IMG+p.img+'.webp" alt=""></div>'+
   '<div class="artgrid">'+toc+'<div class="artbody">'+body+'</div></div>'+
   '<section class="blk" aria-labelledby="art-p"><div class="sec-head row" style="margin:0"><h2 class="h2" id="art-p">Todas con UV400</h2><a class="link" href="listado.html#gafas-de-sol">Ver gafas de sol</a></div><div class="grid">'+['glow','roxy','gala','boston'].map(function(id){return cardHTML(BY[id]);}).join('')+'</div></section>'+
   '<section class="blk" aria-labelledby="art-r" style="padding-bottom:64px"><h2 class="h2" id="art-r">Seguí leyendo</h2><div class="bloggrid three">'+rel.map(function(x){return postCard(x);}).join('')+'</div></section></article>');
  window.addEventListener('hashchange',function(){if(POSTS.some(function(x){return '#'+x.s===location.hash;}))location.reload();});
}

/* Legales */
function pageLegal(){
  var k=location.hash.slice(1)||'terminos',docs={terminos:['Términos y condiciones',['Quiénes somos (razón social, CUIT, domicilio)','Cómo se forma la compra','Precios, impuestos y medios de pago','Envíos y plazos','Cambios, devoluciones y garantía','Derecho de arrepentimiento (Ley 24.240, art. 34)','Datos personales','Jurisdicción y contacto']],privacidad:['Política de privacidad',['Qué datos pedimos y para qué','Cookies y medición','Con quién compartimos datos (Correo Argentino, Mercado Pago)','Cuánto tiempo los guardamos','Tus derechos (Ley 25.326)','Contacto para ejercerlos']]},d=docs[k]||docs.terminos;
  shell('<div class="in legaldoc">'+crumbs([[d[0]]])+'<h1 class="h1">'+d[0]+'</h1><p class="small muted">Última actualización: [fecha]</p><div class="callout"><b>Texto a redactar por un abogado.</b> Esta es la estructura y el diseño de lectura; no se publica con placeholders.</div>'+
   d[1].map(function(t,i){return '<h2 class="h3">'+(i+1)+'. '+t+'</h2><p class="muted">[Texto legal.]</p>';}).join('')+'<p><a class="link" href="legal.html#'+(k==='terminos'?'privacidad':'terminos')+'">'+(k==='terminos'?'Ver política de privacidad':'Ver términos y condiciones')+'</a></p><div style="height:48px"></div></div>',{noNl:true});
  window.addEventListener('hashchange',function(){location.reload();});
}

/* Botón de arrepentimiento */
function pageArrep(){
  shell('<div class="in legaldoc">'+crumbs([['Botón de arrepentimiento']])+'<h1 class="h1">Botón de arrepentimiento</h1><p class="lead muted">Si compraste online, tenés 10 días corridos desde que recibiste el producto para cancelar la compra sin costo y sin dar explicaciones.</p>'+
   '<form class="contform js-arr" novalidate><div class="fgrid">'+fld('a-ped','Número de pedido','inputmode="numeric"','Está en el email de confirmación.','')+fld('a-em','Email de la compra','type="email" autocomplete="email"','','')+fld('a-nom','Nombre y apellido','autocomplete="name"','','full')+area('a-mot','Motivo <span class="muted" style="font-weight:400">(opcional)</span>','No hace falta que nos digas por qué.','full')+'</div>'+
   '<button class="btn btn-primary" type="submit">Cancelar mi compra</button><p class="small muted">Ley 24.240, art. 34, y Resolución 424/2020 de la Secretaría de Comercio Interior.</p></form>'+
   '<div class="acc" style="margin-top:32px"><details><summary>¿Qué pasa después?'+ico('i-plus')+'</summary><div class="body"><p>Te mandamos un código de trámite por email dentro de las 24 horas. Coordinamos la devolución del producto por WhatsApp; el envío corre por nuestra cuenta [confirmar]. Te reintegramos el dinero por el mismo medio de pago.</p></div></details><details><summary>¿Quiero cambiar, no cancelar?'+ico('i-plus')+'</summary><div class="body"><p>Para cambiar por otro modelo o color, mirá <a href="ayuda.html#cambios" style="color:var(--ink)">cambios y devoluciones</a>.</p></div></details></div><div style="height:64px"></div></div>',{noNl:true});
  bindForm($('.js-arr'),{'a-ped':[/^\d{3,}$/,'Revisá el número de pedido: son solo números, por ejemplo 1234.'],'a-em':RE_EMAIL,'a-nom':[/\S/,'Completá tu nombre y apellido.']},function(f){var c='ARR-'+Math.floor(100000+Math.random()*899999);f.innerHTML=okMsg('Recibimos tu pedido de cancelación','Tu código de trámite es <b style="color:var(--ink)">'+c+'</b>. También te lo mandamos por email. Te escribimos para coordinar la devolución.');});
}

/* 404 */
function page404(){
  brandPage();
  shell('<div class="in nf">'+raysSVG(9,160,80)+'<h1 class="h1">No encontramos esta página</h1><p class="lead muted">Puede que el link esté mal escrito o que el modelo ya no esté en el catálogo.</p>'+
   '<form class="inline nfsearch" action="listado.html" onsubmit="event.preventDefault();location.href=\'listado.html#gafas-de-sol\'"><div class="field"><label for="q404">Buscá un modelo</label><input id="q404" type="search" placeholder="Por ejemplo: Glow, carey, aviador"></div><button class="btn btn-primary" type="submit">Buscar</button></form>'+
   '<div class="subcats" style="justify-content:center;flex-wrap:wrap"><a href="listado.html#gafas-de-sol">Gafas de sol</a><a href="listado.html#polarizadas">Polarizadas</a><a href="listado.html#armazones">Armazones</a><a href="listado.html#clip-on">Clip-on</a><a href="listado.html#accesorios">Accesorios</a></div></div>'+
   '<section class="sec" style="padding-top:0"><div class="in"><div class="sec-head row"><h2 class="h2">Recién llegadas</h2><a class="link" href="listado.html#gafas-de-sol">Ver todo</a></div><div class="grid">'+['saturday','charlotte','gala','yanis'].map(function(id){return cardHTML(BY[id],{showNew:true});}).join('')+'</div></div></section>');
}
