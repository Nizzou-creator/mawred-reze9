const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

const cfg = window.APP_CONFIG || {};
const sb = (window.supabase && cfg.supabaseUrl && cfg.supabasePublishableKey)
  ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabasePublishableKey)
  : null;

let currentUser = null;
let currentProfile = null;
let currentListings = [];
let isAdmin = false;

function toast(msg){
  const el=$("#toast"); if(!el)return;
  el.textContent=msg; el.classList.add("show");
  clearTimeout(window._toast);
  window._toast=setTimeout(()=>el.classList.remove("show"),3000);
}

function esc(v){
  return String(v ?? "").replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;","\"":"&quot;"}[c]));
}

function openModal(html){
  $("#modalContent").innerHTML=html;
  $("#modalRoot").classList.add("open");
  document.body.classList.add("modal-open");
  $("#modalRoot").setAttribute("aria-hidden","false");
}
function closeModal(){
  $(".modal-card")?.classList.remove("wide");
  $("#modalRoot").classList.remove("open");
  document.body.classList.remove("modal-open");
  $("#modalRoot").setAttribute("aria-hidden","true");
}
$$("[data-close-modal]").forEach(x=>x.addEventListener("click",closeModal));
document.addEventListener("keydown",e=>{if(e.key==="Escape")closeModal()});

$("#menuBtn")?.addEventListener("click",()=>$("#navLinks")?.classList.toggle("open"));
$$("#navLinks a").forEach(a=>a.addEventListener("click",()=>$("#navLinks")?.classList.remove("open")));

function search(term){
  if(term) $("#searchInput").value=term;
  const q=$("#searchInput").value.trim().toLowerCase(), loc=$("#locationSelect").value;
  const filtered=currentListings.filter(x=>{
    const text=[x.title,x.description,x.category,x.subcategory,x.governorate,x.delegation].join(" ").toLowerCase();
    return (!q || text.includes(q)) && (!loc || x.governorate===loc);
  });
  renderListings(filtered);
  if(!q && !loc){toast("اكتب شنوّة تلوج ولا اختار المنطقة.");return;}
  $("#listings")?.scrollIntoView({behavior:"smooth"});
}
$("#searchBtn")?.addEventListener("click",()=>search());
$("#searchInput")?.addEventListener("keydown",e=>{if(e.key==="Enter")search()});
$$("[data-search]").forEach(b=>b.addEventListener("click",()=>search(b.dataset.search)));
$("#searchTop")?.addEventListener("click",()=>{$("#searchInput")?.focus();window.scrollTo({top:0,behavior:"smooth"})});
$("#filterBtn")?.addEventListener("click",()=>toast("اكتب كلمة في البحث أو اختار الولاية للتصفية."));

function authForm(mode="login"){
  const login=mode==="login";
  openModal(`
    <div class="modal-kicker">${login?"مرحبا بيك 👋":"أهلا بيك في مورد رزق 🤝"}</div>
    <h2>${login?"تسجيل الدخول":"إنشاء حساب مجاني"}</h2>
    <p class="modal-note">${login?"ادخل لحسابك باش تنجم تنشر وتتواصل.":"التسجيل مجاني. اختار نوع حسابك وابدأ معانا."}</p>
    <form id="authForm" class="form-grid">
      ${login?"":`<label>الاسم الكامل<input name="full_name" required maxlength="100" placeholder="مثال: محمد علي" autocomplete="name"></label>`}
      <label>البريد الإلكتروني<input name="email" type="email" required placeholder="name@example.com" autocomplete="email"></label>
      <label>كلمة السر<input name="password" type="password" minlength="6" required placeholder="6 أحرف أو أكثر" autocomplete="${login?"current-password":"new-password"}"></label>
      ${login?"":`<label>رقم الهاتف <span class="muted">(اختياري)</span><input name="phone" inputmode="tel" maxlength="30" placeholder="مثال: 20 000 000"></label>
      <label>الولاية <span class="muted">(اختياري)</span><select name="governorate"><option value="">اختر الولاية</option><option>تونس</option><option>أريانة</option><option>بن عروس</option><option>منوبة</option><option>نابل</option><option>زغوان</option><option>بنزرت</option><option>باجة</option><option>جندوبة</option><option>الكاف</option><option>سليانة</option><option>سوسة</option><option>المنستير</option><option>المهدية</option><option>صفاقس</option><option>القيروان</option><option>القصرين</option><option>سيدي بوزيد</option><option>قابس</option><option>مدنين</option><option>تطاوين</option><option>قبلي</option><option>توزر</option><option>قفصة</option></select></label>
      <label>شنوّة نوع حسابك<select name="account_type"><option value="customer">حريف / طالب خدمة</option><option value="provider">مقدّم خدمة</option><option value="seller">بائع / صاحب سلعة</option></select></label>`}
      <button class="primary-btn" type="submit">${login?"دخول":"إنشاء الحساب"}</button>
    </form>
    <button class="switch-auth" id="switchAuth" type="button">${login?"ما عندكش حساب؟ أنشئ حساب مجاني":"عندك حساب؟ سجّل الدخول"}</button>
  `);
  $("#authForm").addEventListener("submit",async e=>{
    e.preventDefault();
    if(!sb){toast("إعداد Supabase ناقص.");return;}
    const fd=new FormData(e.target), email=String(fd.get("email")||"").trim(), password=String(fd.get("password")||"");
    const btn=e.target.querySelector("button[type=submit]"); btn.disabled=true; btn.textContent="جاري المعالجة...";
    try{
      if(login){
        const {error}=await sb.auth.signInWithPassword({email,password});
        if(error) throw error;
        toast("تم تسجيل الدخول بنجاح ❤️"); closeModal();
      }else{
        const metadata={
          full_name:String(fd.get("full_name")||"").trim(),
          account_type:String(fd.get("account_type")||"customer"),
          phone:String(fd.get("phone")||"").trim()||null,
          governorate:String(fd.get("governorate")||"").trim()||null
        };
        const {data,error}=await sb.auth.signUp({email,password,options:{data:metadata}});
        if(error) throw error;
        if(data.session){
          currentUser=data.session.user;
          await loadProfile(); updateAccountButton();
          toast("الحساب تخلق بنجاح ❤️"); closeModal();
        }else{
          openModal(`<div class="success-icon">✉️</div><h2>الحساب تخلق بنجاح</h2><p class="modal-note">إذا كان تأكيد البريد الإلكتروني مفعّل، ثبت إيميلك من الرسالة اللي بعثهالك Supabase، وبعدها ارجع وسجّل الدخول.</p><button class="primary-btn" id="backLogin" type="button">رجوع لتسجيل الدخول</button>`);
          $("#backLogin").onclick=()=>authForm("login");
        }
      }
    }catch(err){toast(err.message||"صار خطأ، حاول مرة أخرى.");btn.disabled=false;btn.textContent=login?"دخول":"إنشاء الحساب";}
  });
  $("#switchAuth").onclick=()=>authForm(login?"signup":"login");
}

async function loadProfile(){
  if(!sb||!currentUser){currentProfile=null;isAdmin=false;return;}
  const {data}=await sb.from("profiles").select("*").eq("id",currentUser.id).maybeSingle();
  currentProfile=data||null;
  const a=await sb.from("admins").select("user_id").eq("user_id",currentUser.id).maybeSingle();
  isAdmin=!!a.data;
}

function updateAccountButton(){
  const b=$("#accountTop"); if(!b)return;
  if(currentUser){b.textContent=currentProfile?.full_name||"حسابي";} else b.textContent="تسجيل الدخول";
}

async function handleAccount(){
  if(!currentUser){authForm("login");return;}
  const {count}=await sb.from("listings").select("id",{count:"exact",head:true}).eq("owner_id",currentUser.id);
  const myCount=Number(count||0);
  openModal(`<div class="modal-kicker">حسابك في مورد رزق</div><h2>${esc(currentProfile?.full_name||"مستخدم")}</h2><p class="modal-note">${esc(currentUser.email||"")}</p><div class="account-box"><b>${currentProfile?.account_type==="provider"?"مقدّم خدمة":currentProfile?.account_type==="seller"?"بائع / صاحب سلعة":"حريف / طالب خدمة"}</b><span>${esc(currentProfile?.governorate||"الموقع غير محدد")}</span>${currentProfile?.phone?`<span>📱 ${esc(currentProfile.phone)}</span>`:""}</div><button class="primary-btn" id="myListingsBtn">📋 إعلاناتي (${myCount})</button>${isAdmin?`<button class="primary-btn" id="adminBtn">🛡️ لوحة الإدارة</button>`:""}<button class="secondary-btn" id="myPublish">➕ نشر إعلان</button><button class="secondary-btn" id="logoutBtn">تسجيل الخروج</button>`);
  $("#myListingsBtn").onclick=()=>myListings();
  $("#myPublish").onclick=()=>publishForm();
  $("#adminBtn")?.addEventListener("click",()=>adminPanel("listings"));
  $("#logoutBtn").onclick=async()=>{await sb.auth.signOut();closeModal();toast("خرجت من الحساب.");};
}

async function myListings(){
  if(!currentUser){authForm("login");return;}
  const {data,error}=await sb.from("listings").select("id,listing_type,title,description,category,price,price_label,governorate,delegation,phone,status,is_featured,created_at").eq("owner_id",currentUser.id).order("created_at",{ascending:false});
  if(error){toast(error.message||"تعذر تحميل إعلاناتك.");return;}
  const items=data||[];
  openModal(`<div class="modal-kicker">لوحة إعلاناتك 📋</div><h2>إعلاناتي</h2><p class="modal-note">تنجم تعدّل ولا تحذف أي إعلان نشرتو من حسابك.</p><button class="primary-btn" id="myPublishFromList">➕ نشر إعلان جديد</button><div class="my-listings-list">${items.length?items.map(x=>{const price=x.price!=null?`${Number(x.price).toLocaleString("fr-TN")} د.ت`:(x.price_label||"السعر حسب الطلب");const status=x.status==="approved"?"منشور":x.status==="pending"?"قيد المراجعة":x.status==="rejected"?"مرفوض":x.status==="paused"?"متوقف":"منتهي";return `<div class="my-listing-item"><div class="my-listing-head"><span class="tag">${x.listing_type==="product"?"منتج":"خدمة"}</span><span class="my-status">${status}</span></div><h3>${esc(x.title)}</h3><p>${esc((x.description||"").slice(0,120))}</p><div class="listing-meta"><span>📍 ${esc(x.governorate||"غير محدد")}</span><span>💰 ${esc(price)}</span></div><div class="my-listing-actions"><button type="button" class="secondary-btn my-edit-btn" data-id="${esc(x.id)}">✏️ تعديل</button><button type="button" class="danger-btn my-delete-btn" data-id="${esc(x.id)}">🗑️ حذف</button></div></div>`;}).join(""):"<div class=\"empty-state\"><div>📭</div><h3>ما عندك حتى إعلان</h3><p>انشر أول إعلان متاعك وابدأ تلقى حرفاء.</p></div>"}</div>`);
  $("#myPublishFromList").onclick=()=>publishForm();
  $$(".my-edit-btn").forEach(b=>b.addEventListener("click",()=>editListing(b.dataset.id)));
  $$(".my-delete-btn").forEach(b=>b.addEventListener("click",()=>deleteListing(b.dataset.id)));
}

async function editListing(id){
  const {data,error}=await sb.from("listings").select("id,listing_type,title,description,category,price,governorate,delegation,phone").eq("id",id).eq("owner_id",currentUser.id).single();
  if(error||!data){toast("الإعلان هذا ما عادش موجود أو ما عندكش صلاحية تعدلو.");return;}
  openModal(`<div class="modal-kicker">تعديل الإعلان ✏️</div><h2>عدّل إعلانك</h2><form id="editListingForm" class="form-grid">
    <label>نوع الإعلان<select name="listing_type"><option value="service" ${data.listing_type==="service"?"selected":""}>خدمة</option><option value="product" ${data.listing_type==="product"?"selected":""}>منتج</option></select></label>
    <label>العنوان<input name="title" required maxlength="120" value="${esc(data.title||"")}"></label>
    <label>الوصف<textarea name="description" required maxlength="1000">${esc(data.description||"")}</textarea></label>
    <label>التصنيف<input name="category" value="${esc(data.category||"")}" placeholder="مثال: كهرباء"></label>
    <label>السعر<input name="price" type="number" min="0" step="0.001" value="${data.price??""}" placeholder="اختياري"></label>
    <label>الولاية<select name="governorate"><option value="">اختر الولاية</option>${["تونس","سوسة","صفاقس","المنستير","نابل","بنزرت","قابس","مدنين"].map(g=>`<option ${data.governorate===g?"selected":""}>${g}</option>`).join("")}</select></label>
    <label>المعتمدية<input name="delegation" value="${esc(data.delegation||"")}" placeholder="اختياري"></label>
    <label>رقم الهاتف<input name="phone" inputmode="tel" value="${esc(data.phone||"")}" placeholder="اختياري"></label>
    <button class="primary-btn" type="submit">حفظ التعديلات</button>
  </form>`);
  $("#editListingForm").addEventListener("submit",async e=>{
    e.preventDefault();
    const fd=new FormData(e.target);
    const payload={listing_type:fd.get("listing_type"),title:fd.get("title"),description:fd.get("description"),category:fd.get("category")||null,price:fd.get("price")?Number(fd.get("price")):null,governorate:fd.get("governorate")||null,delegation:fd.get("delegation")||null,phone:fd.get("phone")||null};
    const btn=e.target.querySelector("button[type=submit]");btn.disabled=true;btn.textContent="جاري الحفظ...";
    const r=await sb.from("listings").update(payload).eq("id",id).eq("owner_id",currentUser.id);
    if(r.error){toast(r.error.message||"تعذر تعديل الإعلان.");btn.disabled=false;btn.textContent="حفظ التعديلات";return;}
    toast("تم تعديل الإعلان بنجاح ❤️");
    await loadListings();
    myListings();
  });
}

async function deleteListing(id){
  if(!currentUser)return;
  const ok=confirm("متأكد تحب تحذف الإعلان نهائيا؟");
  if(!ok)return;
  const {error}=await sb.from("listings").delete().eq("id",id).eq("owner_id",currentUser.id);
  if(error){toast(error.message||"تعذر حذف الإعلان.");return;}
  toast("تم حذف الإعلان بنجاح 🗑️");
  await loadListings();
  myListings();
}

$('#myListingsNav')?.addEventListener('click',e=>{e.preventDefault();if(!currentUser)authForm('login');else myListings();});

function publishForm(){
  if(!currentUser){closeModal();authForm("login");return;}
  openModal(`<div class="modal-kicker">إعلان جديد 📣</div><h2>انشر خدمتك ولا سلعتك</h2><p class="modal-note">النشر الأساسي مجاني. الإعلان يظهر مباشرة بعد النشر.</p>
    <form id="publishForm" class="form-grid">
      <label>نوع الإعلان<select name="listing_type"><option value="service">خدمة</option><option value="product">منتج</option></select></label>
      <label>العنوان<input name="title" required maxlength="120" placeholder="مثال: كهربائي منازل"></label>
      <label>الوصف<textarea name="description" required maxlength="1000" placeholder="اشرح خدمتك أو السلعة..."></textarea></label>
      <label>التصنيف<input name="category" placeholder="مثال: كهرباء"></label>
      <label>السعر<input name="price" type="number" min="0" step="0.001" placeholder="اختياري"></label>
      <label>الولاية<select name="governorate"><option value="">اختر الولاية</option><option>تونس</option><option>سوسة</option><option>صفاقس</option><option>المنستير</option><option>نابل</option><option>بنزرت</option><option>قابس</option><option>مدنين</option></select></label>
      <label>المعتمدية<input name="delegation" placeholder="اختياري"></label>
      <label>رقم الهاتف<input name="phone" inputmode="tel" placeholder="اختياري"></label>
      <button class="primary-btn" type="submit">نشر الإعلان</button>
    </form>`);
  $("#publishForm").addEventListener("submit",async e=>{
    e.preventDefault();
    const fd=new FormData(e.target), payload={owner_id:currentUser.id,listing_type:fd.get("listing_type"),title:fd.get("title"),description:fd.get("description"),category:fd.get("category")||null,price:fd.get("price")?Number(fd.get("price")):null,governorate:fd.get("governorate")||null,delegation:fd.get("delegation")||null,phone:fd.get("phone")||currentProfile?.phone||null,status:"approved"};
    const btn=e.target.querySelector("button[type=submit]");btn.disabled=true;btn.textContent="جاري النشر...";
    const {error}=await sb.from("listings").insert(payload);
    if(error){toast(error.message||"تعذر نشر الإعلان.");btn.disabled=false;btn.textContent="نشر الإعلان";return;}
    closeModal();toast("تم نشر إعلانك بنجاح ❤️");await loadListings();
  });
}
$("#publishBtn")?.addEventListener("click",publishForm);
$("#messagesBtn")?.addEventListener("click",()=>{if(!currentUser)authForm("login");else messagesInbox();});
$("#notificationsBtn")?.addEventListener("click",notificationsInbox);

async function loadNotificationBadge(){
  if(!sb||!currentUser)return;
  const {count,error}=await sb.from("notifications").select("id",{count:"exact",head:true}).eq("user_id",currentUser.id).eq("is_read",false);
  if(error)return;
  const b=$("#notificationBadge"); if(!b)return;
  const n=Number(count||0); b.textContent=n>99?"99+":String(n); b.hidden=n===0;
}

async function notificationsInbox(){
  if(!currentUser){authForm("login");return;}
  const {data,error}=await sb.from("notifications").select("id,type,title,body,link,is_read,created_at").eq("user_id",currentUser.id).order("created_at",{ascending:false}).limit(30);
  if(error){toast(error.message||"تعذر تحميل الإشعارات.");return;}
  const items=data||[];
  openModal(`<div class="modal-kicker">الإشعارات 🔔</div><h2>إشعاراتك</h2><p class="modal-note">اضغط على رسالة باش تفتح المحادثة مباشرة.</p><div class="notification-list">${items.length?items.map(n=>`<button type="button" class="notification-item ${n.is_read?"read":"unread"}" data-id="${esc(n.id)}" data-link="${esc(n.link||"")}"><div class="notification-icon">${n.type==="message"?"💬":"🔔"}</div><div class="notification-content"><b>${esc(n.title||"إشعار")}</b><p>${esc(n.body||"")}</p><small>${new Date(n.created_at).toLocaleString("fr-TN")}</small></div></button>`).join(""):"<div class=\"empty-state\"><div>🔔</div><h3>ما عندك حتى إشعار</h3><p>كي توصلك رسالة ولا تنبيه، يظهر لهنا.</p></div>"}</div>`);

  // Handle notification taps with event delegation so the handler keeps working
  // even when the modal content is recreated.
  const list=$(".notification-list");
  if(list){
    list.onclick=async e=>{
      const item=e.target.closest(".notification-item");
      if(!item)return;
      const id=item.dataset.id||"";
      const link=item.dataset.link||"";
      if(id){await sb.from("notifications").update({is_read:true}).eq("id",id).eq("user_id",currentUser.id);}
      await loadNotificationBadge();
      if(link){
        closeModal();
        setTimeout(()=>openMessageBox(link),50);
      }else{
        toast("الإشعار هذا ما عندوش محادثة مرتبطة.");
      }
    };
  }
}

async function messagesInbox(){
  if(!currentUser){authForm("login");return;}
  const {data,error}=await sb.from("conversations").select("id,listing_id,customer_id,owner_id,updated_at").or(`customer_id.eq.${currentUser.id},owner_id.eq.${currentUser.id}`).order("updated_at",{ascending:false});
  if(error){toast(error.message||"تعذر تحميل الرسائل.");return;}
  const conversations=data||[];
  if(!conversations.length){
    openModal(`<div class="modal-kicker">الرسائل 💬</div><h2>ما عندكش رسائل تو</h2><p class="modal-note">كي تضغط «تواصل» على أي إعلان، المحادثة متاعك تظهر لهنا.</p>`);
    return;
  }
  const ids=conversations.map(c=>c.listing_id).filter(Boolean);
  const listingMap={};
  if(ids.length){
    const r=await sb.from("listings").select("id,title").in("id",ids);
    (r.data||[]).forEach(x=>listingMap[x.id]=x.title);
  }
  const convIds=conversations.map(c=>c.id);
  const mr=await sb.from("messages").select("conversation_id,sender_id,message,created_at").in("conversation_id",convIds).order("created_at",{ascending:false});
  const lastMap={};
  (mr.data||[]).forEach(m=>{if(!lastMap[m.conversation_id])lastMap[m.conversation_id]=m;});
  openModal(`<div class="modal-kicker">الرسائل 💬</div><h2>محادثاتك</h2><p class="modal-note">اضغط على محادثة باش تكمل الكلام.</p><div class="conversation-list">${conversations.map(c=>{const m=lastMap[c.id];const other=c.customer_id===currentUser.id?"صاحب الإعلان":"الحريف";return `<button class="conversation-item" data-conv="${esc(c.id)}"><div><b>${esc(listingMap[c.listing_id]||"إعلان")}</b><span>${other}</span></div><p>${esc(m?.message||"محادثة جديدة")}</p></button>`;}).join("")}</div>`);
  $$(".conversation-item").forEach(b=>b.addEventListener("click",()=>openMessageBox(b.dataset.conv)));
}

let ratingStats = {};

function renderListings(items){
  const grid=$(".listing-grid"); if(!grid)return;
  if(!items.length){grid.innerHTML=`<div class="empty-state"><div>🔎</div><h3>ما لقيناش إعلانات منشورة</h3><p>جرّب كلمة أخرى أو ولاية أخرى. الإعلانات الجديدة تظهر بعد الموافقة.</p></div>`;return;}
  grid.innerHTML=items.map(x=>{
    const initials=(x.title||"م").trim().charAt(0);
    const tag=x.listing_type==="product"?"منتج":"خدمة";
    const price=x.price!=null?`${Number(x.price).toLocaleString("fr-TN")} د.ت`:(x.price_label||"السعر حسب الطلب");
    const stats=ratingStats[x.id]||{avg:0,count:0};
    const ratingText=stats.count?`⭐ ${stats.avg.toFixed(1)} (${stats.count})`:`⭐ ما فماش تقييمات`;
    return `<article class="listing" data-id="${esc(x.id)}"><div class="listing-top"><div class="avatar purple">${esc(initials)}</div>${x.is_featured?'<span class="verified">★ مميّز</span>':''}</div><span class="tag">${tag}</span><h3>${esc(x.title)}</h3><p>${esc(x.description).slice(0,150)}</p><div class="listing-meta"><span>📍 ${esc(x.governorate||"تونس")}</span><span>💰 ${esc(price)}</span></div><div class="rating-summary">${ratingText}</div><div class="listing-actions"><button class="talk-btn" data-owner="${esc(x.owner_id)}" data-listing="${esc(x.id)}">💬 تواصل</button><button class="rate-btn" data-owner="${esc(x.owner_id)}" data-listing="${esc(x.id)}">⭐ قيّم</button><button class="report-btn" data-owner="${esc(x.owner_id)}" data-listing="${esc(x.id)}">🚩 إبلاغ</button></div></article>`;
  }).join("");
  $$(".talk-btn").forEach(b=>b.addEventListener("click",()=>startConversation(b.dataset.listing,b.dataset.owner)));
  $$(".rate-btn").forEach(b=>b.addEventListener("click",()=>openRatingForm(b.dataset.listing,b.dataset.owner)));
  $$(".report-btn").forEach(b=>b.addEventListener("click",()=>openReportForm(b.dataset.listing,b.dataset.owner)));
}

async function loadRatingStats(items){
  ratingStats={};
  const ids=(items||[]).map(x=>x.id).filter(Boolean);
  if(!ids.length)return;
  const {data,error}=await sb.from("ratings").select("listing_id,rating").in("listing_id",ids).eq("status","approved");
  if(error){console.warn("ratings",error);return;}
  (data||[]).forEach(r=>{
    if(!ratingStats[r.listing_id])ratingStats[r.listing_id]={sum:0,count:0,avg:0};
    ratingStats[r.listing_id].sum+=Number(r.rating||0);
    ratingStats[r.listing_id].count+=1;
    ratingStats[r.listing_id].avg=ratingStats[r.listing_id].sum/ratingStats[r.listing_id].count;
  });
}

async function loadListings(){
  if(!sb)return;
  const {data,error}=await sb.from("listings").select("id,owner_id,listing_type,title,description,category,subcategory,price,price_label,governorate,delegation,is_featured,created_at").eq("status","approved").order("is_featured",{ascending:false}).order("created_at",{ascending:false}).limit(30);
  if(error){console.error(error);toast("تعذر تحميل الإعلانات حاليا.");return;}
  currentListings=data||[];
  await loadRatingStats(currentListings);
  renderListings(currentListings);
}

async function openRatingForm(listingId,ownerId){
  if(!currentUser){authForm("login");return;}
  if(currentUser.id===ownerId){toast("ما تنجمش تقيّم إعلانك إنت.");return;}
  const existing=await sb.from("ratings").select("id,rating").eq("listing_id",listingId).eq("reviewer_id",currentUser.id).maybeSingle();
  if(existing.error){toast("تعذر التثبت من التقييم.");return;}
  if(existing.data){toast(`إنت قيّمت الإعلان هذا بـ ${existing.data.rating} ⭐ من قبل.`);return;}
  const listing=currentListings.find(x=>x.id===listingId);
  openModal(`<div class="modal-kicker">تقييم الإعلان ⭐</div><h2>${esc(listing?.title||"الإعلان")}</h2><p class="modal-note">اختار تقييم من نجمة إلى 5 نجوم.</p><div class="star-picker" id="starPicker">${[1,2,3,4,5].map(n=>`<button type="button" class="star-choice" data-rating="${n}" aria-label="${n} نجوم">★</button>`).join("")}</div><p id="ratingHint" class="rating-hint">اضغط على عدد النجوم اللي تحب عليه.</p><button class="primary-btn" id="submitRating" type="button" disabled>إرسال التقييم</button>`);
  let selected=0;
  $$(".star-choice").forEach(b=>b.addEventListener("click",()=>{selected=Number(b.dataset.rating);$$('.star-choice').forEach(s=>s.classList.toggle('selected',Number(s.dataset.rating)<=selected));$('#ratingHint').textContent=`اخترت ${selected} من 5 ⭐`;$('#submitRating').disabled=false;}));
  $("#submitRating").onclick=async()=>{
    if(!selected)return;
    const btn=$("#submitRating");btn.disabled=true;btn.textContent="جاري الحفظ...";
    const {error}=await sb.from("ratings").insert({listing_id:listingId,reviewer_id:currentUser.id,rating:selected,status:"approved"});
    if(error){toast(error.code==="23505"?"إنت قيّمت الإعلان هذا من قبل.":(error.message||"تعذر حفظ التقييم."));btn.disabled=false;btn.textContent="إرسال التقييم";return;}
    toast("يعطيك الصحة على التقييم ⭐");closeModal();await loadListings();
  };
}

async function openReportForm(listingId,ownerId){
  if(!currentUser){authForm("login");return;}
  if(currentUser.id===ownerId){toast("ما تنجمش تعمل إبلاغ على إعلانك إنت.");return;}
  const existing=await sb.from("reports").select("id,status").eq("listing_id",listingId).eq("reporter_id",currentUser.id).limit(1);
  if(existing.error){toast("تعذر التثبت من البلاغات.");return;}
  if(existing.data?.length){toast("سبق وبلّغت على الإعلان هذا. الإدارة باش تراجع البلاغ.");return;}
  const listing=currentListings.find(x=>x.id===listingId);
  openModal(`<div class="modal-kicker">إبلاغ عن إعلان 🚩</div><h2>${esc(listing?.title||"الإعلان")}</h2><p class="modal-note">اختار السبب. البلاغ يوصل للإدارة للمراجعة.</p><form id="reportForm" class="form-grid"><label>سبب الإبلاغ<select name="reason" required><option value="">اختار السبب</option><option value="fraud">احتيال أو محاولة نصب</option><option value="misleading">معلومات مضللة</option><option value="inappropriate">محتوى غير مناسب</option><option value="prohibited">سلعة أو خدمة ممنوعة</option><option value="spam">إعلان مزعج / مكرر</option><option value="other">سبب آخر</option></select></label><label>تفاصيل إضافية <span class="muted">(اختياري)</span><textarea name="details" maxlength="1000" placeholder="فسّر لنا المشكلة إذا تحب..."></textarea></label><button class="primary-btn" type="submit">إرسال البلاغ</button></form>`);
  $("#reportForm").addEventListener("submit",async e=>{
    e.preventDefault();
    const fd=new FormData(e.target),btn=e.target.querySelector('button[type="submit"]');btn.disabled=true;btn.textContent="جاري الإرسال...";
    const {error}=await sb.from("reports").insert({reporter_id:currentUser.id,listing_id:listingId,reported_user_id:ownerId,reason:fd.get("reason"),details:String(fd.get("details")||"").trim(),status:"pending"});
    if(error){toast(error.code==="23505"?"سبق وبلّغت على الإعلان هذا.":(error.message||"تعذر إرسال البلاغ."));btn.disabled=false;btn.textContent="إرسال البلاغ";return;}
    closeModal();toast("تم إرسال البلاغ للإدارة 🚩");
  });
}

async function startConversation(listingId,ownerId){
  if(!currentUser){authForm("login");return;}
  if(currentUser.id===ownerId){toast("هذا إعلانك إنت.");return;}
  const {data,error}=await sb.from("conversations").select("id").eq("listing_id",listingId).eq("customer_id",currentUser.id).eq("owner_id",ownerId).maybeSingle();
  if(error){toast("تعذر فتح المحادثة.");return;}
  if(data){openMessageBox(data.id);return;}
  const created=await sb.from("conversations").insert({listing_id:listingId,customer_id:currentUser.id,owner_id:ownerId}).select("id").single();
  if(created.error){toast(created.error.message);return;}
  openMessageBox(created.data.id);
}

async function openMessageBox(conversationId){
  openModal(`<div class="modal-kicker">رسالة جديدة 💬</div><h2>تواصل مع صاحب الإعلان</h2><div id="messageHistory" class="message-history"><span>جاري التحميل...</span></div><form id="messageForm" class="message-form"><input name="message" required maxlength="1000" placeholder="اكتب رسالتك..."><button class="primary-btn" type="submit">إرسال</button></form>`);
  const load=async()=>{const {data}=await sb.from("messages").select("id,sender_id,message,created_at").eq("conversation_id",conversationId).order("created_at",{ascending:true});$("#messageHistory").innerHTML=(data||[]).map(m=>`<div class="bubble ${m.sender_id===currentUser.id?"mine":"theirs"}">${esc(m.message)}</div>`).join("")||"<span>ابدأ المحادثة 👋</span>";};
  await load();
  $("#messageForm").addEventListener("submit",async e=>{e.preventDefault();const fd=new FormData(e.target),message=fd.get("message");const {error}=await sb.from("messages").insert({conversation_id:conversationId,sender_id:currentUser.id,message});if(error){toast(error.message);return;}e.target.reset();await load();});
}

/* ===== لوحة الإدارة ===== */
const ADMIN_STATUS={approved:"منشور",pending:"قيد المراجعة",rejected:"مرفوض",paused:"متوقف",expired:"منتهي"};
const REPORT_STATUS={pending:"جديد",reviewing:"قيد المراجعة",resolved:"تمّ الحل",rejected:"مرفوض"};
let adminFilter="all";

async function adminPanel(tab="listings"){
  if(!isAdmin){toast("ما عندكش صلاحية الدخول للوحة الإدارة.");return;}
  openModal(`<div class="modal-kicker">🛡️ الإدارة</div><h2>لوحة الإدارة</h2><div id="adminStats" class="admin-stats"></div><div class="admin-tabs"><button data-tab="listings">📋 الإعلانات</button><button data-tab="reports">🚩 التبليغات</button><button data-tab="users">👥 المستخدمين</button></div><div id="adminBody" class="admin-body"><div class="empty-state">جاري التحميل...</div></div>`);
  $(".modal-card")?.classList.add("wide");
  $$(".admin-tabs button").forEach(b=>{
    b.classList.toggle("active",b.dataset.tab===tab);
    b.addEventListener("click",()=>adminPanel(b.dataset.tab));
  });
  adminStats();
  if(tab==="listings")adminListings();
  else if(tab==="reports")adminReports();
  else adminUsers();
}

async function adminStats(){
  const c=async(t,f)=>{let q=sb.from(t).select("id",{count:"exact",head:true});if(f)q=f(q);const {count}=await q;return Number(count||0);};
  const [all,pending,reports,users]=await Promise.all([
    c("listings"),
    c("listings",q=>q.eq("status","pending")),
    c("reports",q=>q.eq("status","pending")),
    c("profiles")
  ]);
  const el=$("#adminStats");if(!el)return;
  el.innerHTML=`<div><b>${all}</b><span>إعلان</span></div><div><b>${pending}</b><span>قيد المراجعة</span></div><div><b>${reports}</b><span>تبليغ جديد</span></div><div><b>${users}</b><span>مستخدم</span></div>`;
}

async function adminListings(){
  const body=$("#adminBody");if(!body)return;
  let q=sb.from("listings").select("id,owner_id,listing_type,title,description,governorate,status,is_featured,is_top,created_at").order("created_at",{ascending:false}).limit(100);
  if(adminFilter!=="all")q=q.eq("status",adminFilter);
  const {data,error}=await q;
  if(error){body.innerHTML=`<div class="empty-state">${esc(error.message)}</div>`;return;}
  const items=data||[];
  const ids=[...new Set(items.map(x=>x.owner_id))];
  const names={};
  if(ids.length){const r=await sb.from("profiles").select("id,full_name,phone").in("id",ids);(r.data||[]).forEach(p=>names[p.id]=p);}
  body.innerHTML=`<div class="admin-filter">${["all","approved","pending","paused","rejected"].map(s=>`<button data-f="${s}" class="${adminFilter===s?"active":""}">${s==="all"?"الكل":ADMIN_STATUS[s]}</button>`).join("")}</div>
  <div class="my-listings-list">${items.length?items.map(x=>{
    const o=names[x.owner_id]||{};
    return `<div class="my-listing-item" data-id="${esc(x.id)}">
      <div class="my-listing-head"><span class="tag">${x.listing_type==="product"?"منتج":"خدمة"}</span><span class="my-status st-${esc(x.status)}">${ADMIN_STATUS[x.status]||esc(x.status)}</span></div>
      <h3>${esc(x.title)} ${x.is_featured?"⭐":""}${x.is_top?"🔝":""}</h3>
      <p>${esc((x.description||"").slice(0,140))}</p>
      <div class="listing-meta"><span>👤 ${esc(o.full_name||"—")}</span><span>📍 ${esc(x.governorate||"—")}</span><span>${o.phone?"📱 "+esc(o.phone):""}</span></div>
      <div class="admin-actions">
        ${x.status!=="approved"?`<button class="secondary-btn" data-act="status" data-v="approved">✅ قبول</button>`:""}
        ${x.status!=="paused"?`<button class="secondary-btn" data-act="status" data-v="paused">⏸️ إيقاف</button>`:""}
        ${x.status!=="rejected"?`<button class="secondary-btn" data-act="status" data-v="rejected">⛔ رفض</button>`:""}
        <button class="secondary-btn" data-act="flag" data-k="is_featured" data-v="${!x.is_featured}">${x.is_featured?"إلغاء التمييز":"⭐ تمييز"}</button>
        <button class="secondary-btn" data-act="flag" data-k="is_top" data-v="${!x.is_top}">${x.is_top?"إلغاء التثبيت":"🔝 تثبيت"}</button>
        <button class="danger-btn" data-act="delete">🗑️ حذف</button>
      </div></div>`;}).join(""):`<div class="empty-state"><div>📭</div><h3>ما فما حتى إعلان</h3></div>`}</div>`;
  $$(".admin-filter button").forEach(b=>b.addEventListener("click",()=>{adminFilter=b.dataset.f;adminListings();}));
  body.querySelectorAll("[data-act]").forEach(b=>b.addEventListener("click",()=>adminListingAction(b)));
}

async function adminListingAction(btn){
  const id=btn.closest("[data-id]").dataset.id,act=btn.dataset.act;
  let r;
  if(act==="status")r=await sb.from("listings").update({status:btn.dataset.v}).eq("id",id);
  else if(act==="flag")r=await sb.from("listings").update({[btn.dataset.k]:btn.dataset.v==="true"}).eq("id",id);
  else if(act==="delete"){if(!confirm("متأكد تحب تحذف الإعلان نهائيا؟"))return;r=await sb.from("listings").delete().eq("id",id);}
  if(r?.error){toast(r.error.message||"صار خطأ.");return;}
  toast("تمّ ✅");
  adminListings();adminStats();loadListings();
}

async function adminReports(){
  const body=$("#adminBody");if(!body)return;
  const {data,error}=await sb.from("reports").select("id,listing_id,reported_user_id,reason,details,status,created_at").order("created_at",{ascending:false}).limit(100);
  if(error){body.innerHTML=`<div class="empty-state">${esc(error.message)}</div>`;return;}
  const items=data||[];
  const lids=[...new Set(items.map(x=>x.listing_id).filter(Boolean))];
  const titles={};
  if(lids.length){const r=await sb.from("listings").select("id,title,status").in("id",lids);(r.data||[]).forEach(l=>titles[l.id]=l);}
  body.innerHTML=`<div class="my-listings-list">${items.length?items.map(x=>{
    const l=titles[x.listing_id];
    return `<div class="my-listing-item" data-id="${esc(x.id)}" data-listing="${esc(x.listing_id||"")}">
      <div class="my-listing-head"><span class="tag">${esc(x.reason||"تبليغ")}</span><span class="my-status st-${esc(x.status)}">${REPORT_STATUS[x.status]||esc(x.status)}</span></div>
      <h3>${l?esc(l.title):"إعلان محذوف"}</h3>
      <p>${esc(x.details||"بلا تفاصيل")}</p>
      <div class="admin-actions">
        ${l&&l.status==="approved"?`<button class="secondary-btn" data-act="pause">⏸️ إيقاف الإعلان</button>`:""}
        ${x.status!=="reviewing"?`<button class="secondary-btn" data-act="rstatus" data-v="reviewing">🔎 قيد المراجعة</button>`:""}
        ${x.status!=="resolved"?`<button class="secondary-btn" data-act="rstatus" data-v="resolved">✅ تمّ الحل</button>`:""}
        ${x.status!=="rejected"?`<button class="secondary-btn" data-act="rstatus" data-v="rejected">رفض التبليغ</button>`:""}
      </div></div>`;}).join(""):`<div class="empty-state"><div>🎉</div><h3>ما فما حتى تبليغ</h3></div>`}</div>`;
  body.querySelectorAll("[data-act]").forEach(b=>b.addEventListener("click",async()=>{
    const row=b.closest("[data-id]");let r;
    if(b.dataset.act==="pause")r=await sb.from("listings").update({status:"paused"}).eq("id",row.dataset.listing);
    else r=await sb.from("reports").update({status:b.dataset.v}).eq("id",row.dataset.id);
    if(r.error){toast(r.error.message||"صار خطأ.");return;}
    toast("تمّ ✅");adminReports();adminStats();loadListings();
  }));
}

async function adminUsers(){
  const body=$("#adminBody");if(!body)return;
  const {data,error}=await sb.from("profiles").select("id,full_name,account_type,phone,governorate,is_verified,is_blocked,created_at").order("created_at",{ascending:false}).limit(100);
  if(error){body.innerHTML=`<div class="empty-state">${esc(error.message)}</div>`;return;}
  const types={provider:"مقدّم خدمة",seller:"بائع",customer:"حريف"};
  body.innerHTML=`<div class="my-listings-list">${(data||[]).map(u=>`<div class="my-listing-item" data-id="${esc(u.id)}">
    <div class="my-listing-head"><span class="tag">${types[u.account_type]||esc(u.account_type)}</span><span class="my-status">${u.is_blocked?"🚫 موقوف":u.is_verified?"✓ موثوق":"عادي"}</span></div>
    <h3>${esc(u.full_name||"بلا اسم")}</h3>
    <div class="listing-meta"><span>📍 ${esc(u.governorate||"—")}</span><span>${u.phone?"📱 "+esc(u.phone):""}</span></div>
    <div class="admin-actions">
      <button class="secondary-btn" data-k="is_verified" data-v="${!u.is_verified}">${u.is_verified?"إلغاء التوثيق":"✓ توثيق"}</button>
      <button class="${u.is_blocked?"secondary-btn":"danger-btn"}" data-k="is_blocked" data-v="${!u.is_blocked}">${u.is_blocked?"رفع الإيقاف":"🚫 إيقاف الحساب"}</button>
    </div></div>`).join("")}</div>`;
  body.querySelectorAll("[data-k]").forEach(b=>b.addEventListener("click",async()=>{
    const id=b.closest("[data-id]").dataset.id;
    if(b.dataset.k==="is_blocked"&&b.dataset.v==="true"&&!confirm("متأكد تحب توقف هذا الحساب؟"))return;
    const r=await sb.from("profiles").update({[b.dataset.k]:b.dataset.v==="true"}).eq("id",id);
    if(r.error){toast(r.error.message||"صار خطأ.");return;}
    toast("تمّ ✅");adminUsers();
  }));
}


async function boot(){
  if(!sb){toast("Supabase غير مهيّأ في النسخة الحالية.");return;}
  const {data}=await sb.auth.getSession();
  currentUser=data.session?.user||null;
  await loadProfile();updateAccountButton();await loadListings();await loadNotificationBadge();
  sb.auth.onAuthStateChange(async (_event,session)=>{currentUser=session?.user||null;await loadProfile();updateAccountButton();if(_event==="SIGNED_IN"){loadListings();loadNotificationBadge();}else if(_event==="SIGNED_OUT"){const b=$("#notificationBadge");if(b){b.hidden=true;b.textContent="0";}}});
}
boot();
