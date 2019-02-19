'use strict';

var SVG2LDRAW = {};

/*
  The main purpose of this library is to performs SVG to LDraw pattern transformation.
  Currently supported content of SVG files is:
  - Paths consisting of the commands mentioned in path_simplification.js
 */
SVG2LDRAW.Svg = function() {

}

    SVG2LDRAW.Svg.prototype.toLDraw = function(decomposition, scaleW, scaleH, thickness, c) {
    var minX = Number.MAX_VALUE, minY = Number.MAX_VALUE;
    var maxX = Number.MIN_VALUE, maxY = Number.MIN_VALUE;

    decomposition.paths.forEach(path => path.pts.forEach(function(p) {
                minX = Math.min(minX, p.x);
                minY = Math.min(minY, p.y);
                maxX = Math.max(maxX, p.x);
                maxY = Math.max(maxY, p.y);
            }));
    const w = maxX-minX, h = maxY-minY;
    const midX = (maxX+minX)*0.5, midY = (maxY+minY)*0.5;

    function convert(x, mid, scale) {
        x = ((mid-x)*scale).toFixed(UTIL.Precision);
        for(var i = 0; i < UTIL.Precision; i++) {
            var tmp = parseFloat(x).toFixed(i);
            if(parseFloat(tmp) == parseFloat(x)) {
                return tmp; // Don't output too many '0's.
            }
        }
        return x;
    }

    var reverse = (scaleW < 0) != (scaleH < 0);

    var cnt = 0;
    var ret = '0 Name: ' + (decomposition.name ? decomposition.name : 'INSERT_NAME_HERE');
    ret += `
0 Author: svg2ldraw
0 !LICENSE Redistributable under CCAL version 2.0 : see CAreadme.txt
0 BFC CERTIFY CCW
`;
    function handlePath(path) {
        if(path.pts.length > 4) { // Extract a quad:
            var path1 = {pts:path.pts.slice(0, 4), lDrawColor:path.lDrawColor};
            var pts2 = [ path.pts[0] ];
            pts2.push(...path.pts.slice(3));
            var path2 = {pts:pts2, lDrawColor:path.lDrawColor};
            handlePath(path1);
            handlePath(path2);
            return;
        }
        const pts = path.pts;
        ret += pts.length + " " + path.lDrawColor;
        for(var j = 0; j < pts.length; j++) {
            var k = reverse ? pts.length-1-j : j;
            ret += " " + convert(pts[k].x, midX, -scaleW) + " " + (-thickness) + "  " + convert(pts[k].y, midY, scaleH);
        }
        ret += '\n';
        cnt++;
    }
    decomposition.paths.forEach(handlePath);

    // `Add box if thickness > 0:
    if(thickness > 0) {
        console.log('Adding box due to thickness being ' + thickness);
        minX = convert(minX, midX, -scaleW);
        maxX = convert(maxX, midX, -scaleW);
        minY = convert(minY, midY, scaleH);
        maxY = convert(maxY, midY, scaleH);
        var t = -thickness;
        function output(coords) {
            ret += "4 " + c;
            coords.forEach(coord => ret += " " + coord);
            ret += '\n';
        }
        // Below:
        output([maxX, 0, maxY, minX, 0, maxY, minX, 0, minY, maxX, 0, minY]);
        // 4 sides:
        output([minX, 0, minY, minX, t, minY, maxX, t, minY, maxX, 0, minY]);
        output([maxX, 0, maxY, maxX, t, maxY, minX, t, maxY, minX, 0, maxY]);
        output([minX, 0, maxY, minX, t, maxY, minX, t, minY, minX, 0, minY]);
        output([maxX, 0, minY, maxX, t, minY, maxX, t, maxY, maxX, 0, maxY]);
        cnt += 5;
    }

    console.log('Built lDraw file from ' + cnt + ' triangles and quads.');
    return ret;
}