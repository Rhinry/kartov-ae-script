// KARTOV PRO SUITE - STABLE CLEANUP

function getComp() { var c = app.project.activeItem; return (c instanceof CompItem) ? c : null; }
function getLayers() { var c = getComp(); return c ? c.selectedLayers : []; }

function undo(func, name) {
    app.beginUndoGroup(name);
    func();
    app.endUndoGroup();
}

// --- SCREENSHOT (DIRECT PNG API) ---
function takeScreenshot() {
    var comp = app.project.activeItem;
    if (!comp || !(comp instanceof CompItem)) { 
        alert("Lütfen ekran görüntüsü almak için bir kompozisyonu açın."); 
        return; 
    }
    var targetFile = File.saveDialog("Ekran Görüntüsünü Kaydet", "PNG:*.png");
    if (targetFile) {
        if (targetFile.name.toLowerCase().indexOf(".png") === -1) {
            targetFile = new File(targetFile.fullName + ".png");
        }
        try {
            comp.saveFrameToPng(comp.time, targetFile);
            if(targetFile.parent.exists) {
                targetFile.parent.execute();
            }
        } catch(e) {
            alert("Ekran görüntüsü kaydedilemedi.\nHata: " + e.toString());
        }
    }
}

// --- COLOR LABELS ---
function applyLabel(idx) {
    var layers = getLayers();
    for(var i=0; i<layers.length; i++) layers[i].label = idx;
}

// --- BATCH RENAME ---
function batchRename(newName) {
    var layers = getLayers();
    for(var i=0; i<layers.length; i++) {
        if(layers.length === 1) layers[i].name = newName;
        else layers[i].name = newName + "_" + (i+1);
    }
}

// --- MOTION TOOLS ---
// Yardımcı Fonksiyon: Özelliğin boyutuna göre uygun uzunlukta Ease dizisi üretir
function getEaseArray(prop, easeObj) {
    var dim = 1;
    if (prop.propertyValueType === PropertyValueType.TwoD_SPATIAL || prop.propertyValueType === PropertyValueType.TwoD) dim = 2;
    if (prop.propertyValueType === PropertyValueType.ThreeD_SPATIAL || prop.propertyValueType === PropertyValueType.ThreeD) dim = 3;
    
    var easeArr = [];
    for (var i = 0; i < dim; i++) easeArr.push(easeObj);
    return easeArr;
}

function applyEase(inVal, outVal) {
    var props = getComp().selectedProperties;
    for(var i=0; i<props.length; i++) {
        var p = props[i];
        if(p.numKeys > 1) {
            var inEase = getEaseArray(p, new KeyframeEase(0, inVal));
            var outEase = getEaseArray(p, new KeyframeEase(0, outVal));
            for(var k=1; k<=p.numKeys; k++) {
                p.setTemporalEaseAtKey(k, inEase, outEase);
            }
        }
    }
}

function addExpression(code) {
    var props = getComp().selectedProperties;
    for(var i=0; i<props.length; i++) {
        if(props[i].canSetExpression) props[i].expression = code;
    }
}

function autoKeyframe(type) {
    var layers = getLayers();
    var c = getComp();
    if (!c) return;
    var t = c.time;
    var d = c.frameDuration;

    // Boyut hatasını çözen yerel ease fonksiyonu
    function localEase(prop) {
        if(prop.numKeys > 0) {
            var easeArr = getEaseArray(prop, new KeyframeEase(0, 33));
            for(var k=1; k<=prop.numKeys; k++) {
                prop.setTemporalEaseAtKey(k, easeArr, easeArr);
            }
        }
    }

    for(var i=0; i<layers.length; i++) {
        var L = layers[i];
        if(type == "pop") {
            var s = L.transform.scale;
            var is3D = L.threeDLayer; // 3D kontrolü
            s.setValueAtTime(t, is3D ? [0,0,0] : [0,0]);
            s.setValueAtTime(t + 10*d, is3D ? [110,110,110] : [110,110]);
            s.setValueAtTime(t + 15*d, is3D ? [100,100,100] : [100,100]);
            localEase(s);
        }
        if(type == "fade") {
            var o = L.transform.opacity;
            o.setValueAtTime(L.inPoint, 0);
            o.setValueAtTime(L.inPoint + 15*d, 100);
            o.setValueAtTime(L.outPoint - 15*d, 100);
            o.setValueAtTime(L.outPoint, 0);
        }
        if(type == "slide") {
            var p = L.transform.position;
            var cur = p.value;
            // Z ekseni (3D) varsa koru, yoksa 2D kullan
            p.setValueAtTime(t, L.threeDLayer ? [cur[0]-300, cur[1], cur[2]] : [cur[0]-300, cur[1]]);
            p.setValueAtTime(t + 15*d, cur);
            localEase(p);
            L.transform.opacity.setValueAtTime(t, 0);
            L.transform.opacity.setValueAtTime(t+10*d, 100);
        }
        if(type == "swing") {
            var r = (L.threeDLayer) ? L.transform.zRotation : L.transform.rotation;
            var cur = r.value;
            r.setValueAtTime(t, cur+15);
            r.setValueAtTime(t+10*d, cur-10);
            r.setValueAtTime(t+20*d, cur+5);
            r.setValueAtTime(t+30*d, cur);
            localEase(r);
        }
    }
}

function applyWiggle(type) {
    var layers = getLayers();
    for(var i=0; i<layers.length; i++) {
        var L = layers[i];
        if(type == "2d") L.transform.position.expression = "wiggle(5, 15);";
        if(type == "3d") {
            if(!L.threeDLayer) L.threeDLayer = true;
            L.transform.zRotation.expression = "wiggle(2, 10);";
        }
        if(type == "handheld") {
            L.transform.position.expression = "wiggle(1, 15);";
            // 3D ise zRotation'ı salla, 2D ise normal rotation'ı
            var rProp = L.threeDLayer ? L.transform.zRotation : L.transform.rotation;
            rProp.expression = "wiggle(2, 1);";
        }
        if(type == "ui") {
            // Evrensel isim (MatchName) kullanımı
            var ef1 = L.Effects.addProperty("ADBE Slider Control"); 
            ef1.name="Freq"; ef1.property(1).setValue(5);
            
            var ef2 = L.Effects.addProperty("ADBE Slider Control"); 
            ef2.name="Amp"; ef2.property(1).setValue(20);
            
            var code = "f=effect('Freq')(1); a=effect('Amp')(1); wiggle(f,a);";
            if(L.transform.position.canSetExpression) L.transform.position.expression = code;
        }
    }
}

function setAnchor(idx) {
    var layers = getLayers();
    if (!layers) return;
    app.beginUndoGroup("Set Anchor Point");
    for (var i = 0; i < layers.length; i++) {
        var L = layers[i];
        if (L instanceof CameraLayer || L instanceof LightLayer) continue;
        var rect = L.sourceRectAtTime(L.containingComp.time, false);
        var x = rect.left;
        if (idx % 3 === 1) x += rect.width / 2;
        if (idx % 3 === 2) x += rect.width;
        var y = rect.top;
        if (idx >= 3 && idx <= 5) y += rect.height / 2;
        if (idx >= 6) y += rect.height;
        var anchor = L.property("Anchor Point").value;
        var position = L.property("Position").value;
        var scale = L.property("Scale").value;
        var rotation = L.property("Rotation").value;
        if (L.threeDLayer) {
            try {
                var newAnchor3D = [x, y, anchor[2]];
                var worldPosOld = L.toComp([anchor[0], anchor[1], 0]);
                L.property("Anchor Point").setValue(newAnchor3D);
                var worldPosNew = L.toComp([newAnchor3D[0], newAnchor3D[1], 0]);
                var delta3D = [worldPosNew[0] - worldPosOld[0], worldPosNew[1] - worldPosOld[1]];
                L.property("Position").setValue([position[0] - delta3D[0], position[1] - delta3D[1], position[2]]);
            } catch(e) { L.property("Anchor Point").setValue([x, y, anchor[2]]); }
        } else {
            var newAnchor = [x, y];
            var deltaX = newAnchor[0] - anchor[0];
            var deltaY = newAnchor[1] - anchor[1];
            var rad = rotation * (Math.PI / 180);
            var cos = Math.cos(rad);
            var sin = Math.sin(rad);
            var sx = scale[0] / 100;
            var sy = scale[1] / 100;
            var moveX = (deltaX * sx * cos) - (deltaY * sy * sin);
            var moveY = (deltaX * sx * sin) + (deltaY * sy * cos);
            L.property("Anchor Point").setValue(newAnchor);
            L.property("Position").setValue([position[0] + moveX, position[1] + moveY]);
        }
    }
    app.endUndoGroup();
}

function shapeOp(type) {
    var layers = getLayers();
    for(var i=0; i<layers.length; i++) {
        if(layers[i] instanceof ShapeLayer) {
            if(type=="round") layers[i].content.addProperty("ADBE Vector Filter - RC");
            if(type=="trim") layers[i].content.addProperty("ADBE Vector Filter - Trim");
            if(type=="stroke") layers[i].content.addProperty("ADBE Vector Graphic - Stroke");
        }
    }
}

function rigOp(type) {
    var layers = getLayers(); var c = getComp();
    if(type=="null") {
        var n = c.layers.addNull(); n.name = "Rig Control"; n.moveBefore(layers[0]);
        n.label = 2; 
        n.transform.position.setValue(layers[0].transform.position.value);
        for(var i=0; i<layers.length; i++) layers[i].parent = n;
    }
    if(type=="individual") {
        for(var i=0; i<layers.length; i++) {
            var L = layers[i];
            var n = c.layers.addNull();
            n.source.name = "Null";
            n.name = L.name + " NULL";
            n.label = 2; 
            n.moveBefore(L);
            if(L.threeDLayer) n.threeDLayer = true;
            if(L.transform.position.numKeys == 0)
                 n.transform.position.setValue(L.transform.position.value);
            else
                 n.transform.position.setValue(L.transform.position.valueAtTime(c.time, false));
            L.parent = n;
        }
    }
    if(type=="offset") {
        for(var i=0; i<layers.length; i++) layers[i].startTime += i * (5*c.frameDuration);
    }
    if(type=="chain") {
        for(var i=0; i<layers.length-1; i++) layers[i+1].parent = layers[i];
    }
    if(type=="shy") {
        for(var i=0; i<layers.length; i++) layers[i].shy = !layers[i].shy;
        c.hideShyLayers = !c.hideShyLayers;
    }
}

function createItem(type) {
    var c = getComp();
    if(type=="Null") c.layers.addNull();
    if(type=="Solid") c.layers.addSolid([0,0,0],"Solid",c.width,c.height,1);
    if(type=="Adj") { var l=c.layers.addSolid([1,1,1],"Adj",c.width,c.height,1); l.adjustmentLayer=true; }
    if(type=="Cam") c.layers.addCamera("Camera", [c.width/2, c.height/2]);
}

function applyTextAnim(type) {
    var layers = getLayers();
    for(var i=0; i<layers.length; i++) {
        var L = layers[i];
        if(!(L instanceof TextLayer)) continue;
        var anim = L.Text.Animators.addProperty("ADBE Text Animator");
        if(type == "typewriter") {
            anim.name = "Typewriter";
            anim.Properties.addProperty("ADBE Text Opacity").setValue(0);
            var sel = anim.Selectors.addProperty("ADBE Text Selector");
            sel.Start.setValue(0); sel.End.setValue(0);
            sel.End.setValueAtTime(L.inPoint, 0); sel.End.setValueAtTime(L.inPoint+1.5, 100);
        }
        if(type == "fadeWords") {
            anim.name = "Fade Words";
            anim.Properties.addProperty("ADBE Text Opacity").setValue(0);
            var sel = anim.Selectors.addProperty("ADBE Text Selector");
            sel.Advanced.BasedOn.setValue(2);
            sel.Advanced.Shape.setValue(4);
            sel.Offset.setValueAtTime(L.inPoint, -100); sel.Offset.setValueAtTime(L.inPoint+1, 100);
        }
        if(type == "decode") {
            anim.name = "Decoder";
            anim.Properties.addProperty("ADBE Text Opacity").setValue(0);
            anim.Properties.addProperty("ADBE Text Character Offset").setValue(10);
            var sel = anim.Selectors.addProperty("ADBE Text Selector");
            sel.Start.setValueAtTime(L.inPoint, 0); sel.Start.setValueAtTime(L.inPoint+1, 100);
        }
        if(type == "tracking") {
            anim.name = "Tracking";
            anim.Properties.addProperty("ADBE Text Opacity").setValue(0);
            anim.Properties.addProperty("ADBE Text Track Amount").setValue(30);
            var sel = anim.Selectors.addProperty("ADBE Text Selector");
            sel.Advanced.Shape.setValue(4); 
            sel.Offset.setValueAtTime(L.inPoint, -100); sel.Offset.setValueAtTime(L.inPoint+1.5, 100);
        }
        if(type == "slideLines") {
            anim.name = "Slide Lines";
            var pos = anim.Properties.addProperty("ADBE Text Position");
            pos.setValue([0, 100]);
            anim.Properties.addProperty("ADBE Text Opacity").setValue(0);
            var sel = anim.Selectors.addProperty("ADBE Text Selector");
            sel.Advanced.BasedOn.setValue(3);
            sel.Advanced.Shape.setValue(4); 
            sel.Offset.setValueAtTime(L.inPoint, -100); 
            sel.Offset.setValueAtTime(L.inPoint + 1, 100);
        }
    }
}

function convertText(mode) {
    var layers = getLayers();
    for(var i=0; i<layers.length; i++) {
        if(layers[i] instanceof TextLayer) {
            var t = layers[i].text.sourceText.value.toString();
            if(mode=="up") layers[i].text.sourceText.setValue(t.toUpperCase());
            if(mode=="low") layers[i].text.sourceText.setValue(t.toLowerCase());
            if(mode=="cap") {
                var caps = t.replace(/\b\w/g, function(l){ return l.toUpperCase() });
                layers[i].text.sourceText.setValue(caps);
            }
        }
    }
}

function prodOp(type) {
    var c = getComp();
    var sel = app.project.selection;

    if(type == "clean") app.executeCommand(2004);
    if(type == "precomp") {
        var idx = []; var layers = getLayers();
        if(layers){ for(var i=0; i<layers.length; i++) idx.push(layers[i].index); c.layers.precompose(idx, "New Precomp", true); }
    }
    if(type == "render") {
        var addedCount = 0;
        if (sel && sel.length > 0) {
            for (var i = 0; i < sel.length; i++) {
                if (sel[i] instanceof CompItem) { app.project.renderQueue.items.add(sel[i]); addedCount++; }
            }
        } else if (c && c instanceof CompItem) { app.project.renderQueue.items.add(c); addedCount++; }
        if(addedCount === 0) alert("Lütfen Render Kuyruğuna eklemek için bir Kompozisyon seçin.");
    }
    if(type == "ame") {
        try { app.executeCommand(3800); } catch(e) { alert("Media Encoder hatası: " + e.toString()); }
    }
    if(type == "purge") {
        try { app.purge(PurgeTarget.ALL_CACHES); alert("RAM ve Disk Temizlendi!"); } catch(e) { app.executeCommand(10200); alert("RAM Temizlendi."); }
    }
    if(type == "screenshot") {
        takeScreenshot();
    }
}

function timeOp(type) {
    var layers = getLayers();
    for(var i=0; i<layers.length; i++) {
        if(type=="post") layers[i].effect.addProperty("Posterize Time").property(1).setValue(12);
        if(type=="rev") app.executeCommand(2135);
    }
}

function createFolders() {
    var n = ["01_MAIN", "02_COMPS", "03_ASSETS", "04_AUDIO", "05_RENDER"];
    for(var i=0; i<n.length; i++) app.project.items.addFolder(n[i]);
}

function runCreateLegalText() {
    var c = getComp();
    app.beginUndoGroup("Legal");
    var t = c.layers.addText("YASAL UYARI / LEGAL TEXT");
    t.position.setValue([c.width/2, c.height-50]);
    app.endUndoGroup();
}

function createLegalLayer() { runCreateLegalText(); }

function runPalConvert() {
    var sel = app.project.selection;
    if (!sel || sel.length === 0) { alert("Lütfen proje panelinden kompozisyon seçin."); return; }
    app.beginUndoGroup("Kartov PAL Batch Convert");
    var successCount = 0; var errorLog = "";
    for (var s = 0; s < sel.length; s++) {
        var comp = sel[s];
        if (!(comp instanceof CompItem)) continue;
        if (comp.numLayers > 2) { errorLog += "\n❌ " + comp.name + ": 2'den fazla katman var."; continue; }
        try {
            var originalWidth = comp.width; var originalHeight = comp.height;
            comp.width = 720; comp.height = 576; comp.pixelAspect = 1.0; comp.frameRate = 25.0;
            var offsetX = (comp.width - originalWidth) / 2; var offsetY = (comp.height - originalHeight) / 2;
            for (var i = 1; i <= comp.numLayers; i++) {
                var L = comp.layers[i];
                if (L.transform && L.transform.position) {
                    var pos = L.transform.position; var is3D = L.threeDLayer;
                    if (pos.numKeys === 0) {
                        var v = pos.value;
                        if(is3D) pos.setValue([v[0]+offsetX, v[1]+offsetY, v[2]]);
                        else pos.setValue([v[0]+offsetX, v[1]+offsetY]);
                    } else {
                        for (var k = 1; k <= pos.numKeys; k++) {
                            var t = pos.keyTime(k); var v = pos.keyValue(k);
                            if(is3D) pos.setValueAtTime(t, [v[0]+offsetX, v[1]+offsetY, v[2]]);
                            else pos.setValueAtTime(t, [v[0]+offsetX, v[1]+offsetY]);
                        }
                    }
                }
            }
            var nullL = comp.layers.addNull(); nullL.name = "PAL_Control"; nullL.moveToBeginning();
            for(var i=1; i<=comp.numLayers; i++) { if(comp.layers[i]!==nullL && !comp.layers[i].parent) comp.layers[i].parent = nullL; }
            nullL.transform.scale.setValue([37.5, 37.5]); successCount++;
        } catch (err) { errorLog += "\n⚠️ " + comp.name + " hatası."; }
    }
    app.endUndoGroup();
    var resultMsg = successCount + " adet kompozisyon PAL formatına çevrildi.";
    if (errorLog !== "") resultMsg += "\n\nAtlananlar/Hatalar:" + errorLog;
    alert(resultMsg);
}

// --- AUTO COLORIZE LAYERS ---
function autoColorizeLayers(prefs) {
    var targetComps = [];
    var sel = app.project.selection;
    
    if (sel && sel.length > 0) {
        for (var i = 0; i < sel.length; i++) {
            if (sel[i] instanceof CompItem) targetComps.push(sel[i]);
        }
    }
    
    if (targetComps.length === 0 && app.project.activeItem instanceof CompItem) {
        targetComps.push(app.project.activeItem);
    }

    if (targetComps.length === 0) {
        alert("Lütfen bir kompozisyon açın veya proje panelinden seçin.");
        return;
    }

    app.beginUndoGroup("Otomatik Renklendir");

    for (var c = 0; c < targetComps.length; c++) {
        var comp = targetComps[c];
        
        for (var l = 1; l <= comp.numLayers; l++) {
            var layer = comp.layer(l);
            
            if (layer.adjustmentLayer) { layer.label = prefs.adj; } 
            else if (layer instanceof TextLayer) { layer.label = prefs.text; } 
            else if (layer instanceof ShapeLayer) { layer.label = prefs.shape; } 
            else if (layer instanceof CameraLayer) { layer.label = prefs.cam; } 
            else if (layer instanceof LightLayer) { layer.label = prefs.light; } 
            else if (layer.hasAudio && !layer.hasVideo) { layer.label = prefs.audio; } 
            else if (layer instanceof AVLayer) {
                if (layer.nullLayer) { layer.label = prefs.null; } 
                else if (layer.source) {
                    if (layer.source instanceof CompItem) { layer.label = prefs.precomp; } 
                    else if (layer.source.mainSource instanceof SolidSource) { layer.label = prefs.solid; } 
                    else if (layer.source instanceof FootageItem) {
                        if (layer.source.mainSource.isStill) { layer.label = prefs.still; } 
                        else { layer.label = prefs.video; } 
                    }
                }
            }
        }
    }
    app.endUndoGroup();
}

// --- PROXY TOGGLE ---
function toggleProxies(state) {
    var items = app.project.items;
    if(!items || items.length === 0) return;
    
    app.beginUndoGroup(state ? "Proxyleri Aç" : "Proxyleri Kapat");
    
    for (var i = 1; i <= items.length; i++) {
        try {
            // Sadece FootageItem ve CompItem'lar proxy alabilir
            if (items[i] instanceof CompItem || items[i] instanceof FootageItem) {
                items[i].useProxy = state;
            }
        } catch(e) {
            // Öğede proxy ayarlı değilse After Effects hata verir. 
            // Try/catch ile bu hatayı yok sayıp sessizce devam ediyoruz.
        } 
    }
    
    app.endUndoGroup();
}