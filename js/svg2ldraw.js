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
    const xSub = decomposition.width*0.5*scaleW;
    const yAdd = decomposition.height*0.5*scaleH;

    const precision = this.precision;
    function convertX(x) {
        x = x*scaleW;
        if(x == Math.floor(x))
            return x;
        return x.toFixed(precision);
    }
    function convertY(y) {
        y = y*scaleH;
        if(y == Math.floor(y))
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
        const pts = path.points;
        ret += pts.length + " " + path.lDrawColor;
        for(var j = 0; j < pts.length; j++) {
            var k = reverse ? pts.length-1-j : j;
            ret += " " + convertX(pts[k].x-xSub) + " " + path.z + " " + convertY(-pts[k].y+yAdd);
        }
        ret += '\n';
    }
    return ret;
}