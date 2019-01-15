"use strict";

LDR.int2RGB = function(i) {    
    const b = (i & 0xff);
    i = i >> 8;
    const g = (i & 0xff);
    i = i >> 8;
    const r = i;
    return [r, g, b];
}

LDR.ColorTransformation = function(map) {
    this.colors = [];
    this.map = map || {};
    
    function toHex(i) {
        var h = i.toString(16);
        if (h.length == 1) {
            return '0' + h;
        }
        return h;
    }

    for(var i = 0; i < 495; i++) {
        const c = LDR.Colors[i];
        if(!c || c.alpha)
            continue;
        var [r,g,b] = LDR.int2RGB(c.value);
        const hex = '#' + toHex(r) + toHex(g) + toHex(b);
        this.colors.push({r:r, g:g, b:b, id:i, c:c, hex:hex});
    }
}

LDR.ColorTransformation.prototype.transformPaths = function(paths) {
    for(var i = 0; i < paths.length; i++) {
        const path = paths[i];
        var color = this.transform(path.color);
        path.color = color.hex;
        path.lDrawColor = color.id;
    }
}

LDR.ColorTransformation.prototype.transform = function(htmlColor) {
    if(this.map[htmlColor])
        return this.map[htmlColor];

    if(htmlColor.startsWith('#'))
        htmlColor = htmlColor.slice(1);
    const colorAsInt = parseInt(htmlColor, 16);
    const [r,g,b] = LDR.int2RGB(colorAsInt);
    
    const colors = this.colors;
    function diff(i) {
        const c = colors[i];
        const dr = r-c.r, dg = g-c.g, db = b-c.b;
        return dr*dr + dg*dg + db*db;
    }

    var best = colors[0];
    var bestDiff = diff(0);
    for(var i = 1; i < colors.length; i++) {
        const d = diff(i);
        if(d < bestDiff) {
            best = colors[i];
            bestDiff = d;
        }
    }
    this.map[htmlColor] = best;
    return best;
}