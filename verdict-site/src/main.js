import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import './style.css';

function init(){
  var root=document.documentElement;
  var reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var G=gsap, ST=ScrollTrigger;
  var motion=!reduce;

  /* ---------- text split (word masks) ---------- */
  function split(el){
    var out=[];
    function walk(node,parent){
      if(node.nodeType===3){
        node.textContent.split(/(\s+)/).forEach(function(part){
          if(!part) return;
          if(/^\s+$/.test(part)){ parent.appendChild(document.createTextNode(' ')); return; }
          var m=document.createElement('span'); m.className='wm';
          var i=document.createElement('span'); i.className='wi'; i.textContent=part;
          m.appendChild(i); parent.appendChild(m); out.push(i);
        });
      } else if(node.nodeType===1){
        var c=node.cloneNode(false); parent.appendChild(c);
        Array.prototype.slice.call(node.childNodes).forEach(function(k){ walk(k,c); });
      }
    }
    var label=el.textContent.replace(/\s+/g,' ').trim();
    var kids=Array.prototype.slice.call(el.childNodes); el.innerHTML='';
    kids.forEach(function(k){ walk(k,el); });
    Array.prototype.slice.call(el.children).forEach(function(c){ c.setAttribute('aria-hidden','true'); });
    var sr=document.createElement('span'); sr.className='sr'; sr.textContent=label; el.appendChild(sr);
    return out;
  }

  /* ---------- live fake countdown (it resets: that is the point) ---------- */
  var secs=299, timer=document.getElementById('timer');
  setInterval(function(){ secs=secs>0?secs-1:299; var m=Math.floor(secs/60), s=secs%60; timer.textContent='0'+m+':'+(s<10?'0':'')+s; },1000);

  /* ---------- aurora backdrop (low-res canvas, scaled up by CSS) ---------- */
  var cv=document.getElementById('aurora'), ctx=cv.getContext('2d'), auroraOn=true;
  var blobs=[{x:.18,y:.28,r:.55,c:'36,227,160',a:.16,sx:.00011,sy:.00007},{x:.82,y:.2,r:.6,c:'143,114,247',a:.2,sx:-.00008,sy:.0001},{x:.55,y:.85,r:.5,c:'92,60,180',a:.18,sx:.00006,sy:-.00009}];
  function size(){ cv.width=Math.max(160,Math.round(innerWidth/6)); cv.height=Math.max(120,Math.round(innerHeight/6)); }
  size(); addEventListener('resize',function(){ size(); if(reduce) requestAnimationFrame(draw); });
  var last=0;
  function draw(t){
    if(auroraOn && !document.hidden && t-last>33){
      last=t; var w=cv.width,h=cv.height; ctx.clearRect(0,0,w,h);
      blobs.forEach(function(b,i){
        var x=(b.x+Math.sin(t*b.sx*6+i)*.08)*w, y=(b.y+Math.cos(t*b.sy*6+i)*.08)*h, r=b.r*Math.max(w,h);
        var g=ctx.createRadialGradient(x,y,0,x,y,r); g.addColorStop(0,'rgba('+b.c+','+b.a+')'); g.addColorStop(1,'rgba('+b.c+',0)');
        ctx.fillStyle=g; ctx.fillRect(0,0,w,h);
      });
    }
    if(!reduce) requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);

  /* ---------- nav state ---------- */
  var nav=document.getElementById('nav');
  function navState(y){ nav.classList.toggle('is-scrolled', y>24); }
  addEventListener('scroll',function(){ navState(scrollY); },{passive:true});

  /* ---------- magnetic buttons (pointer devices only) ---------- */
  if(window.matchMedia('(hover: hover) and (pointer: fine)').matches && !reduce){
    document.querySelectorAll('.magnetic').forEach(function(el){
      el.addEventListener('pointermove',function(e){ var r=el.getBoundingClientRect(); var dx=(e.clientX-r.left-r.width/2)*.28, dy=(e.clientY-r.top-r.height/2)*.38; el.style.transform='translate('+dx+'px,'+dy+'px)'; });
      el.addEventListener('pointerleave',function(){ el.style.transform=''; });
    });
  }

  /* ---------- bento spotlight ---------- */
  document.querySelectorAll('.cell').forEach(function(c){
    c.addEventListener('pointermove',function(e){ var r=c.getBoundingClientRect(); c.style.setProperty('--mx',(e.clientX-r.left)+'px'); c.style.setProperty('--my',(e.clientY-r.top)+'px'); });
  });

  if(!motion){ root.classList.add('static'); return; }

  /* ================= MOTION ================= */
  G.registerPlugin(ST);

  var lenis=null;
  {
    lenis=new Lenis({duration:1.15,smoothWheel:true,wheelMultiplier:1});
    lenis.on('scroll',ST.update);
    G.ticker.add(function(t){ lenis.raf(t*1000); });
    G.ticker.lagSmoothing(0);
  }
  document.querySelectorAll('a[href^="#"]').forEach(function(a){
    a.addEventListener('click',function(e){
      var id=a.getAttribute('href'); var t=id==='#top'?0:document.querySelector(id); if(t===null) return; if(t&&t.parentElement.classList.contains('pin-spacer')) t=t.parentElement;
      e.preventDefault();
      if(lenis) lenis.scrollTo(t,{offset:id==='#top'?0:-10,duration:1.4}); else (t===0?window.scrollTo({top:0,behavior:'smooth'}):t.scrollIntoView({behavior:'smooth'}));
    });
  });

  /* hero intro: word masks rise, the rest follows */
  var heroWords=split(document.getElementById('heroTitle'));
  G.timeline({defaults:{ease:'power4.out'}})
    .from(heroWords,{yPercent:115,duration:1.05,stagger:.06},.1)
    .from('.eyebrow',{autoAlpha:0,x:-16,duration:.7},.15)
    .from('[data-hero]',{autoAlpha:0,y:24,duration:.8,stagger:.08},.45)
    .from('.stamp',{autoAlpha:0,y:60,rotate:0,duration:1.1,stagger:.12,ease:'expo.out'},.35);

  /* stamps drift on scroll; aurora fades as the hero leaves */
  document.querySelectorAll('[data-float]').forEach(function(el){
    G.to(el,{yPercent:+el.getAttribute('data-float'),ease:'none',scrollTrigger:{trigger:'.hero',start:'top top',end:'bottom top',scrub:true}});
  });
  G.to('#aurora',{opacity:.35,ease:'none',scrollTrigger:{trigger:'.hero',start:'center top',end:'bottom top',scrub:true}});

  /* ---------- the x-ray scene ---------- */
  (function(){
    var sec=document.getElementById('xray'), co=document.getElementById('checkout'), scan=document.getElementById('scan');
    var steps=G.utils.toArray('.xstep'), ticks=G.utils.toArray('.xtick i'), flags=G.utils.toArray('.xflag');
    function rowTop(id){ return function(){ var r=document.getElementById(id); return (r.offsetTop + r.offsetHeight/2) + 'px'; }; }
    flags.forEach(function(f){ var row=document.getElementById(f.getAttribute('data-row')); G.set(f,{top:function(){ return row.offsetTop - 12; }}); });
    G.set(steps.slice(1),{autoAlpha:0,y:28});
    G.set(flags,{autoAlpha:0,scale:.7,transformOrigin:'right center'});
    G.set('.fee-line',{height:0,autoAlpha:0});
    G.set('#verdictBar',{autoAlpha:0,y:40});

    function swap(tl,a,b,at){ tl.to(steps[a],{autoAlpha:0,y:-28,duration:.35},at).fromTo(steps[b],{autoAlpha:0,y:28},{autoAlpha:1,y:0,duration:.4},'<.12').to(ticks[b-1],{scaleX:1,duration:.4},'<'); }

    var tl=G.timeline({defaults:{ease:'power2.inOut'},scrollTrigger:{trigger:sec,start:'top top',end:'+=340%',pin:true,scrub:.7,anticipatePin:1,invalidateOnRefresh:true}});
    tl.to(scan,{autoAlpha:1,duration:.2})
      .to(scan,{top:rowTop('rowTimer'),duration:1})
      .to('#rowTimer .hl',{autoAlpha:1,duration:.3}).to(flags[0],{autoAlpha:1,scale:1,duration:.35,ease:'back.out(2)'},'<');
    swap(tl,0,1,'<');
    tl.to({}, {duration:.5})
      .to(scan,{top:rowTop('rowFees'),duration:1})
      .to('#feeNote',{autoAlpha:0,height:0,duration:.3})
      .to('.fee-line',{height:'auto',autoAlpha:1,duration:.5},'<')
      .to('#rowFees .co-line',{},'<')
      .to(flags[1],{autoAlpha:1,scale:1,duration:.35,ease:'back.out(2)'},'<.2');
    swap(tl,1,2,'<');
    tl.to({}, {duration:.5})
      .to(scan,{top:rowTop('rowAddon'),duration:1})
      .to('#rowAddon .hl',{autoAlpha:1,duration:.3})
      .to('.chk-x',{autoAlpha:1,duration:.3},'<')
      .to('#lineAddon',{autoAlpha:.25,duration:.3},'<')
      .to(flags[2],{autoAlpha:1,scale:1,duration:.35,ease:'back.out(2)'},'<');
    swap(tl,2,3,'<');
    tl.to({}, {duration:.5})
      .to(scan,{top:rowTop('rowTotal'),duration:.8})
      .to('.co-total .strike',{scaleX:1,duration:.4})
      .to('#realTotal',{autoAlpha:1,duration:.4},'<.1')
      .to(scan,{autoAlpha:0,duration:.3})
      .to('#verdictBar',{autoAlpha:1,y:0,duration:.6,ease:'power3.out'},'<');
    swap(tl,3,4,'<');
    tl.to({}, {duration:.6});
  })();

  /* ---------- statement: words light up as you read ---------- */
  var sw=split(document.getElementById('statement'));
  document.getElementById('statement').classList.add('sw');
  G.fromTo(sw,{opacity:.16},{opacity:1,stagger:.08,ease:'none',scrollTrigger:{trigger:'.statement',start:'top 72%',end:'bottom 45%',scrub:true}});

  /* ---------- horizontal chapters (desktop) ---------- */
  var mm=G.matchMedia();
  mm.add('(min-width: 900px)',function(){
    var track=document.getElementById('howTrack');
    function dist(){ return Math.max(0, track.scrollWidth - innerWidth); }
    G.to(track,{x:function(){ return -dist(); },ease:'none',scrollTrigger:{trigger:'.how-pin',start:'top top',end:function(){ return '+='+dist(); },pin:true,scrub:.8,invalidateOnRefresh:true,anticipatePin:1}});
    G.utils.toArray('.panel').forEach(function(p,i){ G.from(p,{autoAlpha:.25,scale:.94,duration:1,ease:'none',scrollTrigger:{trigger:'.how-pin',start:'top top+=' + (i*120),end:'+=' + (innerWidth*.5),scrub:true}}); });
  });
  mm.add('(max-width: 899px)',function(){
    G.utils.toArray('.how-intro, .panel').forEach(function(p){ G.from(p,{autoAlpha:0,y:40,duration:.9,ease:'power3.out',scrollTrigger:{trigger:p,start:'top 86%',once:true}}); });
  });

  /* ---------- generic reveals ---------- */
  G.utils.toArray('[data-reveal]').forEach(function(el){ G.set(el,{autoAlpha:0,y:44}); });
  ST.batch('[data-reveal]',{start:'top 88%',once:true,onEnter:function(b){ G.to(b,{autoAlpha:1,y:0,duration:.95,stagger:.09,ease:'power3.out',overwrite:true}); }});

  /* ---------- table rows ---------- */
  G.from('.cmp tbody tr',{autoAlpha:0,x:-24,duration:.6,stagger:.08,ease:'power2.out',scrollTrigger:{trigger:'.cmp',start:'top 80%',once:true}});

  /* ---------- counters ---------- */
  G.utils.toArray('[data-count]').forEach(function(el){
    var end=+el.getAttribute('data-count'), o={v:0}; el.textContent='0';
    ST.create({trigger:el,start:'top 88%',once:true,onEnter:function(){ G.to(o,{v:end,duration:1.6,ease:'power3.out',onUpdate:function(){ el.textContent=Math.round(o.v).toLocaleString('en-US'); }}); }});
  });

  /* ---------- closing headline ---------- */
  var cw=split(document.getElementById('closeTitle'));
  G.from(cw,{yPercent:115,duration:1.1,stagger:.07,ease:'power4.out',scrollTrigger:{trigger:'.close',start:'top 70%',once:true}});

  /* fonts change line metrics: re-measure pins once they land */
  if(document.fonts&&document.fonts.ready) document.fonts.ready.then(function(){ ST.refresh(); });
  addEventListener('load',function(){ ST.refresh(); });
}

init();
