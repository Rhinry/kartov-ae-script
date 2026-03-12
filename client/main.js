/* global CSInterface */
(function () {
    'use strict';
    var cs = new CSInterface();
    var path = cs.getSystemPath(SystemPath.EXTENSION);
    cs.evalScript('$.evalFile("' + path + '/host/index.jsx")');

    // --- FAVORITE SYSTEM ---
    var favorites = JSON.parse(localStorage.getItem('kartov_favs')) || [];

    function injectStars() {
        var btns = document.querySelectorAll('.btn');
        btns.forEach(btn => {
            if(!btn.dataset.cmd || btn.id === "btnToggleLabels" || btn.id === "btnProxyToggle") return;
            var star = document.createElement('span');
            star.className = 'star-toggle';
            star.innerHTML = '★';
            if(favorites.includes(btn.dataset.cmd)) star.classList.add('active');
            star.onclick = function(e) {
                e.stopPropagation(); 
                toggleFavorite(btn.dataset.cmd, star);
            };
            btn.appendChild(star);
        });
        renderFavoritesTab();
    }

    function toggleFavorite(cmd, starElem) {
        var idx = favorites.indexOf(cmd);
        if(idx > -1) {
            favorites.splice(idx, 1);
            if(starElem) starElem.classList.remove('active');
        } else {
            favorites.push(cmd);
            if(starElem) starElem.classList.add('active');
        }
        localStorage.setItem('kartov_favs', JSON.stringify(favorites));
        
        var allStars = document.querySelectorAll('.star-toggle');
        allStars.forEach(s => {
            if(s.parentElement.dataset.cmd === cmd) {
                if(favorites.includes(cmd)) s.classList.add('active');
                else s.classList.remove('active');
            }
        });
        renderFavoritesTab();
    }

    function renderFavoritesTab() {
        var favGrid = document.getElementById('fav-grid');
        favGrid.innerHTML = "";
        if(favorites.length === 0) {
            favGrid.innerHTML = '<div style="grid-column: span 2; text-align:center; color:#666; padding:20px; font-size:10px;">Favori eklemek için yıldızlara tıklayın.</div>';
            return;
        }
        favorites.forEach(cmd => {
            var originalBtn = document.querySelector(`.btn[data-cmd="${cmd}"]`);
            if(originalBtn) {
                var clone = originalBtn.cloneNode(true);
                attachEvents(clone);
                var cloneStar = clone.querySelector('.star-toggle');
                cloneStar.onclick = function(e) {
                    e.stopPropagation();
                    toggleFavorite(cmd, cloneStar);
                };
                favGrid.appendChild(clone);
            }
        });
    }

    // --- DRAG & DROP TABS SYSTEM ---
    function initTabSort() {
        var el = document.getElementById('tabContainer');
        var savedOrder = JSON.parse(localStorage.getItem('kartov_tab_order'));
        if (savedOrder) {
            savedOrder.forEach(targetId => {
                var tab = el.querySelector(`[data-target="${targetId}"]`);
                if(tab) el.appendChild(tab);
            });
        }
        new Sortable(el, {
            animation: 150,
            ghostClass: 'sortable-ghost-tab',
            dragClass: 'sortable-drag-tab',
            onEnd: function (evt) {
                var order = [];
                var tabs = el.querySelectorAll('.tab');
                tabs.forEach(t => order.push(t.dataset.target));
                localStorage.setItem('kartov_tab_order', JSON.stringify(order));
            }
        });
    }

    // --- AUTO LABEL SETTINGS BUILDER ---
    var labelConfigGrid = document.getElementById('labelConfigGrid');
    var colorOptions = ["0: Yok", "1: Kırmızı", "2: Sarı", "3: Aqua", "4: Pembe", "5: Lavanta", "6: Şeftali", "7: Deniz Köpüğü", "8: Mavi", "9: Yeşil", "10: Mor", "11: Turuncu", "12: Kahve", "13: Fuşya", "14: Camgöbeği", "15: Kum", "16: Koyu Yeşil"];
    var aeColors = ["#666666", "#b53838", "#e3d94c", "#a8ccc7", "#e6bdc9", "#a8a3c4", "#e6c7a1", "#b2c7b2", "#688fad", "#4f7a54", "#7f598c", "#d68f3d", "#9b7f61", "#d16691", "#59a6a6", "#a89973", "#335438"];
    var defaultColors = { precomp: 8, solid: 15, text: 1, shape: 11, adj: 9, null: 4, cam: 14, light: 6, video: 3, still: 5, audio: 2 };
    var labelsMap = { precomp: "Precomp", solid: "Solid", text: "Text", shape: "Shape", adj: "Adj", null: "Null", cam: "Camera", light: "Light", video: "Video", still: "Görsel", audio: "Ses" };

    var htmlStr = "";
    for(var key in defaultColors) {
        htmlStr += '<div class="label-config-item">';
        htmlStr += '<span>'+labelsMap[key]+'</span>';
        htmlStr += '<div class="label-config-right">';
        htmlStr += '<span class="color-swatch" id="swatch_'+key+'" style="background-color:'+aeColors[defaultColors[key]]+';"></span>';
        htmlStr += '<select id="sel_'+key+'" data-key="'+key+'">';
        for(var i=0; i<=16; i++) {
            var sel = (i === defaultColors[key]) ? "selected" : "";
            htmlStr += '<option value="'+i+'" '+sel+'>'+colorOptions[i]+'</option>';
        }
        htmlStr += '</select></div></div>';
    }
    labelConfigGrid.innerHTML = htmlStr;

    for(var key in defaultColors) {
        var selElem = document.getElementById('sel_'+key);
        selElem.onchange = function() {
            var k = this.getAttribute('data-key');
            var val = parseInt(this.value);
            document.getElementById('swatch_'+k).style.backgroundColor = aeColors[val];
        };
    }

    // --- ANIMATION PREVIEW LOGIC & MOUSE TRACKING ---
    var animPreview = document.getElementById('animPreview');
    var pBox = document.getElementById('pBox');
    var pText = document.getElementById('pText');
    
    // Tıklanılan komutların CSS class karşılıkları (Tüm yeni animasyonlar eklendi)
    var animMap = {
        'ease': { type: 'box', cls: 'run-ease' },
        'easeIn': { type: 'box', cls: 'run-ease-in' },
        'easeOut': { type: 'box', cls: 'run-ease-out' },
        'bounce': { type: 'box', cls: 'run-bounce' },
        'overshoot': { type: 'box', cls: 'run-overshoot' },
        'elastic': { type: 'box', cls: 'run-elastic' },
        'auto_pop': { type: 'box', cls: 'run-pop' },
        'auto_fade': { type: 'box', cls: 'run-fade' },
        'auto_slide': { type: 'box', cls: 'run-slide' },
        'auto_swing': { type: 'box', cls: 'run-swing' },
        'shake_2d': { type: 'box', cls: 'run-shake2d' },
        'shake_3d': { type: 'box', cls: 'run-shake3d' },
        'cam_hand': { type: 'box', cls: 'run-handheld' },
        'wiggle_con': { type: 'box', cls: 'run-wiggle' },
        'exp_loop': { type: 'box', cls: 'run-loop' },
        'exp_ping': { type: 'box', cls: 'run-ping' },
        'exp_inert': { type: 'box', cls: 'run-inertia' },
        'txt_type': { type: 'text', cls: 'run-type', txt: 'TEXT' },
        'txt_track': { type: 'text', cls: 'run-track', txt: 'TEXT' },
        'txt_fade': { type: 'text', cls: 'run-fadeWords', txt: 'TEXT' }
    };

    // Fareyi takip etmesi için dinleyici
    document.addEventListener('mousemove', function(e) {
        if(animPreview.classList.contains('show')) {
            var x = e.clientX + 15; // Farenin hemen sağ altı
            var y = e.clientY + 15;
            
            // Eğer kutu sağdan veya alttan ekrandan taşacaksa farenin soluna/üstüne al
            if(x + 115 > window.innerWidth) x = e.clientX - 125;
            if(y + 80 > window.innerHeight) y = e.clientY - 90;
            
            animPreview.style.left = x + 'px';
            animPreview.style.top = y + 'px';
        }
    });

    // --- CORE UI LOGIC ---
    function createRipple(event) {
        const button = event.currentTarget;
        const circle = document.createElement("span");
        const diameter = Math.max(button.clientWidth, button.clientHeight);
        const radius = diameter / 2;
        const rect = button.getBoundingClientRect();
        circle.style.width = circle.style.height = `${diameter}px`;
        circle.style.left = `${event.clientX - rect.left - radius}px`;
        circle.style.top = `${event.clientY - rect.top - radius}px`;
        circle.classList.add("ripple");
        const existingRipple = button.getElementsByClassName("ripple")[0];
        if (existingRipple) existingRipple.remove();
        button.appendChild(circle);
    }

    function showToast(message, type = 'normal') {
        var container = document.getElementById('toast-container');
        var toast = document.createElement('div');
        toast.className = 'toast ' + type;
        toast.innerHTML = message;
        container.appendChild(toast);
        setTimeout(() => { toast.remove(); }, 3000);
    }

    var tabContainer = document.getElementById('tabContainer');
    tabContainer.onclick = function(e) {
        if(e.target.classList.contains('tab')) {
            var tabs = document.querySelectorAll('.tab');
            var panels = document.querySelectorAll('.content-panel');
            tabs.forEach(x => x.classList.remove('active'));
            panels.forEach(x => x.classList.remove('active'));
            e.target.classList.add('active');
            document.getElementById(e.target.dataset.target).classList.add('active');
        }
    }

    var tooltip = document.getElementById('tooltip');
    
    function attachEvents(btn) {
        if(btn.classList.contains('btn') || btn.classList.contains('c-btn')) {
            btn.addEventListener("click", createRipple);
        }
        
        // HOVER BAŞLADIĞINDA:
        btn.onmouseenter = function() { 
            if(this.dataset.tip) tooltip.innerText = this.dataset.tip; 
            
            var cmd = this.dataset.cmd;
            if(cmd && animMap[cmd]) {
                pBox.className = 'preview-box'; 
                pText.className = 'preview-text'; 
                
                var animData = animMap[cmd];
                if(animData.type === 'box') {
                    pBox.classList.add(animData.cls);
                } else {
                    pText.innerText = animData.txt;
                    pText.classList.add(animData.cls);
                }
                animPreview.classList.add('show');
            }
        }
        
        // HOVER BİTTİĞİNDE:
        btn.onmouseleave = function() { 
            tooltip.innerText = "KARTOV SCRIPT - Ready"; 
            animPreview.classList.remove('show');
        }

        btn.onclick = function(e) {
            if(e.target.classList.contains('star-toggle')) return;

            var c = this.dataset.cmd;
            if(this.id === 'btnCalc' || this.id === 'btnRename' || this.id === 'btnToggleLabels' || this.id === 'btnProxyToggle') return; 
            if(!c) return;

            if(c.startsWith('col_')) {
                cs.evalScript('undo(function(){applyLabel('+c.split('_')[1]+')}, "Label Color")'); return;
            }

            if(c == 'auto_label') { 
                var prefs = {};
                for(var key in defaultColors) {
                    prefs[key] = parseInt(document.getElementById('sel_'+key).value);
                }
                var scriptStr = "autoColorizeLayers(" + JSON.stringify(prefs) + ");";
                cs.evalScript(scriptStr);
                showToast("Katmanlar Renklendirildi!", "success"); 
                return; 
            }

            if(c=='prd_shot') { cs.evalScript('takeScreenshot()'); return; }

            if(c=='ease') cs.evalScript('undo(function(){applyEase(33,33)}, "Ease")');
            if(c=='easeIn') cs.evalScript('undo(function(){applyEase(33,0)}, "Ease In")');
            if(c=='easeOut') cs.evalScript('undo(function(){applyEase(0,33)}, "Ease Out")');
            
            if(c.startsWith('bounce') || c=='overshoot' || c=='elastic') {
                var code = (c=='bounce') ? "amp=0.1;freq=2;decay=2;" : (c=='elastic') ? "amp=0.05;freq=4;decay=5;" : "amp=0.1;freq=1;decay=4;";
                code += "n=0;if(numKeys>0){n=nearestKey(time).index;if(key(n).time>time)n--;}if(n==0){t=0}else{t=time-key(n).time}if(n>0&&t<1){v=velocityAtTime(key(n).time-thisComp.frameDuration/10);value+v*amp*Math.sin(freq*t*2*Math.PI)/Math.exp(decay*t)}else{value}";
                cs.evalScript('undo(function(){addExpression("'+code+'")}, "Bounce Exp")');
            }

            if(c.startsWith('auto_')) cs.evalScript('undo(function(){autoKeyframe("'+c.split('_')[1]+'")}, "Auto Anim")');
            if(c.startsWith('shake_') || c=='cam_hand' || c=='wiggle_con') {
                var type = (c=='shake_2d')?'2d':(c=='shake_3d')?'3d':(c=='cam_hand')?'handheld':'ui';
                cs.evalScript('undo(function(){applyWiggle("'+type+'")}, "Apply Wiggle")');
            }

            if(c.startsWith('anc_')) cs.evalScript('undo(function(){setAnchor('+c.split('_')[1]+')}, "Anchor")');
            if(c.startsWith('sh_')) cs.evalScript('undo(function(){shapeOp("'+c.split('_')[1]+'")}, "Shape Op")');
            if(c=='null_rig') cs.evalScript('undo(function(){rigOp("null")}, "Null Rig")');
            if(c=='offset') cs.evalScript('undo(function(){rigOp("offset")}, "Offset")');
            if(c=='parent_chain') cs.evalScript('undo(function(){rigOp("chain")}, "Chain")');
            if(c=='shy_tog') cs.evalScript('undo(function(){rigOp("shy")}, "Shy Toggle")');

            if(c.startsWith('mk_')) {
                if(c=='mk_legal_layer') cs.evalScript('undo(createLegalLayer, "Legal")');
                else cs.evalScript('undo(function(){createItem("'+(c.split('_')[1].charAt(0).toUpperCase() + c.split('_')[1].slice(1))+'")}, "Create")');
            }

            if(c.startsWith('txt_')) cs.evalScript('undo(function(){applyTextAnim("'+(c=='txt_type'?'typewriter':c=='txt_fade'?'fadeWords':c=='txt_decode'?'decode':'tracking')+'")}, "Text Anim")');
            if(c.startsWith('cnv_')) cs.evalScript('undo(function(){convertText("'+c.split('_')[1]+'")}, "Convert")');

            if(c.startsWith('time_')) cs.evalScript('undo(function(){timeOp("'+c.split('_')[1]+'")}, "Time Op")');
            if(c=='prd_fold') cs.evalScript('createFolders()');
            if(c=='prd_clean') cs.evalScript('prodOp("clean")');
            if(c=='prd_pre') cs.evalScript('undo(function(){prodOp("precomp")}, "Precomp")');
            if(c=='prd_nulls') cs.evalScript('undo(function(){rigOp("individual")}, "Individual Nulls")');
            
            if(c=='prd_ren') { cs.evalScript('prodOp("render")'); showToast("Kuyruğa Eklendi", "success"); }
            if(c=='prd_ame') { cs.evalScript('prodOp("ame")'); showToast("AME Başlatılıyor...", "normal"); }
            if(c=='prd_purge') { cs.evalScript('prodOp("purge")'); showToast("RAM Temizlendi!", "error"); }

            if(c=='pal_convert') cs.evalScript('runPalConvert()');

            if(c.startsWith('exp_')) {
                var ex = (c=='exp_loop')?'loopOut()':(c=='exp_ping')?'loopOut("pingpong")':'amp=0.05;freq=4;decay=2;n=0;if(numKeys>0){n=nearestKey(time).index;if(key(n).time>time)n--;}if(n==0){t=0}else{t=time-key(n).time}if(n>0&&t<1){v=velocityAtTime(key(n).time-thisComp.frameDuration/10);value+v*amp*Math.sin(freq*t*2*Math.PI)/Math.exp(decay*t)}else{value}';
                cs.evalScript('undo(function(){addExpression("'+ex+'")}, "Add Exp")');
            }
        }
    }

    var allBtns = document.querySelectorAll('.btn, .c-btn, .g-btn');
    allBtns.forEach(b => attachEvents(b));

    // ÖZEL BUTONLARIN TIKLAMA OLAYLARI
    document.getElementById('btnToggleLabels').onclick = function() {
        labelConfigGrid.classList.toggle('open');
    }

    var isProxyOn = false;
    var btnProxy = document.getElementById('btnProxyToggle');
    if(btnProxy) {
        btnProxy.onclick = function() {
            isProxyOn = !isProxyOn;
            if (isProxyOn) {
                this.innerHTML = "🟢 Proxies: AÇIK";
                this.style.borderLeft = "3px solid #4ADE80"; 
                cs.evalScript('toggleProxies(true)');
                showToast("Proxy'ler Aktif Edildi!", "success");
            } else {
                this.innerHTML = "🔴 Proxies: KAPALI";
                this.style.borderLeft = "3px solid #F44336"; 
                cs.evalScript('toggleProxies(false)');
                showToast("Proxy'ler Kapatıldı!", "error");
            }
        };
    }

    document.getElementById('btnRename').onclick = function() {
        var name = document.getElementById('renameInp').value;
        if(!name) { showToast("İsim giriniz!", "error"); return; }
        cs.evalScript('undo(function(){batchRename("'+name+'")}, "Batch Rename")');
        showToast("İsimlendirildi", "success");
    }

    document.getElementById('btnCalc').onclick = function() {
        var val = document.getElementById('legalInp').value.trim();
        if(!val) { showToast("Lütfen metin giriniz!", "error"); return; }
        
        var w = val.split(/\s+/).length;
        document.getElementById('resW').innerText = w;
        
        var calculatedTime = w / 2.5; 
        var time = Math.max(5, calculatedTime).toFixed(2);
        
        document.getElementById('resT').innerText = time + "s";
        showToast(`Hesaplandı: ${w} Kelime`, "success");
    }

    var searchInput = document.getElementById('searchInput');
    var resultGrid = document.getElementById('search-results-grid');
    var body = document.body;

    searchInput.onkeyup = function() {
        var val = this.value.toLowerCase().trim();
        resultGrid.innerHTML = "";
        if (val.length > 0) {
            body.classList.add('search-active');
            allBtns.forEach(b => {
                if(b.id === 'btnCalc' || b.id === 'btnRename' || b.id === 'btnToggleLabels' || b.id === 'btnProxyToggle') return;
                var txt = b.innerText.toLowerCase() + " " + (b.dataset.tip || "").toLowerCase();
                if (txt.includes(val)) {
                    var clone = b.cloneNode(true);
                    attachEvents(clone);
                    resultGrid.appendChild(clone);
                }
            });
        } else {
            body.classList.remove('search-active');
        }
    };

    // --- INIT ---
    injectStars();
    initTabSort(); 

})();