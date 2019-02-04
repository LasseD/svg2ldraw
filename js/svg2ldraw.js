'use strict';

var SVG2LDRAW = {};

/*
  The main purpose of this library is to performs SVG to LDraw pattern transformation.
  Currently supported content of SVG files is:
  - Paths consisting of the commands mentioned in path_simplification.js
 */
SVG2LDRAW.Svg = function() {
    this.precision = 4; // LDraw output precision
}

SVG2LDRAW.Svg.prototype.toLDraw = function(decomposition, scaleW, scaleH) {
    var minX = Number.MAX_VALUE, minY = Number.MAX_VALUE;
    var maxX = Number.MIN_VALUE, maxY = Number.MIN_VALUE;

    decomposition.trapezoids.forEach(path => path.pts.forEach(function(p) {
                minX = Math.min(minX, p.x);
                minY = Math.min(minY, p.y);
                maxX = Math.max(maxX, p.x);
                maxY = Math.max(maxY, p.y);
            }));
    const w = maxX-minX, h = maxY-minY;
    const midX = (maxX+minX)*0.5, midY = (maxY+minY)*0.5;

    const precision = this.precision;
    function convertX(x) {
        x = -(midX-x)*scaleW;
        if(x == parseInt(x))
            return x;
        return x.toFixed(precision);
    }
    function convertY(y) {
        y = (midY-y)*scaleH;
        if(y == parseInt(y))
            return y;
        return y.toFixed(precision);
    }
    var reverse = (scaleW < 0) != (scaleH < 0);

    var ret = '0 Name: ' + (decomposition.name ? decomposition.name : 'INSERT_NAME_HERE');
    ret += `
0 Author: svg2ldraw
0 !LICENSE Redistributable under CCAL version 2.0 : see CAreadme.txt
0 BFC CERTIFY CCW
`;
    const paths = decomposition.trapezoids;
    for(var i = 0; i < paths.length; i++) {
        const path = paths[i];
        const pts = path.pts;
        ret += pts.length + " " + path.lDrawColor;
        for(var j = 0; j < pts.length; j++) {
            var k = reverse ? pts.length-1-j : j;
            ret += " " + convertX(pts[k].x) + " 0 " + convertY(pts[k].y);
        }
        ret += '\n';
    }
    return ret;
}