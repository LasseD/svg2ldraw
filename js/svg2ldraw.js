var SVG2LDRAW = {};

/*
  The main purpose of this library is to performs SVG to LDraw pattern transformation.
  Currently supported content of SVG files is:
  - Paths consisting of the commands mentioned in path_simplification.js
 */
SVG2LDRAW.Svg = function() {
    this.precision = 4;
}

SVG2LDRAW.Svg.prototype.toLDraw = function(decomposition, scale) {
    scale = scale || 1;
    
    const precision = this.precision;
    function convert(x) {
        x = x*scale;
        if(x == Math.floor(x))
            return x;
        return x.toFixed(precision);
    }

    var ret = '0 Name: ' + (decomposition.name ? decomposition.name : 'INSERT_NAME_HERE');
    ret += `
0 Author: svg2ldraw
0 !LICENSE Redistributable under CCAL version 2.0 : see CAreadme.txt
`;
    const paths = decomposition.trapezoids;
    for(var i = 0; i < paths.length; i++) {
        const path = paths[i];
        const pts = path.points;
        ret += pts.length + " " + path.lDrawColor;
        for(var j = 0; j < pts.length; j++) {
            ret += " " + convert(pts[j].x) + " 0 " + convert(pts[j].y);
        }
        ret += '\n';
    }
    return ret;
}