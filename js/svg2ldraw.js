'use strict';

var SVG2LDRAW = {};

/*
  The main purpose of this library is to performs SVG to LDraw pattern transformation.
  Currently supported content of SVG files is:
  - Paths consisting of the commands mentioned in path_simplification.js
 */
SVG2LDRAW.Svg = function() {

}

SVG2LDRAW.Svg.prototype.toLDraw = function(decomposition, scaleW, scaleH) {
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

    function convert(x, scale) {
        x = (-(midX-x)*scale).toFixed(UTIL.Precision);
        for(var i = 0; i < UTIL.Precision; i++) {
            var tmp = parseFloat(x).toFixed(i);
            if(parseFloat(tmp) == parseFloat(x)) {
                return tmp; // Don't output too many '0's.
            }
        }
        return x;
    }

    var reverse = (scaleW < 0) != (scaleH < 0);

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
            ret += " " + convert(pts[k].x, scaleW) + " 0 " + convert(pts[k].y, scaleH);
        }
        ret += '\n';
    }
    decomposition.paths.forEach(handlePath);
    return ret;
}