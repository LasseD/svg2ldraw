var SVG2LDRAW = {};

/*
  The main purpose of this library is to performs SVG to LDraw pattern transformation.
  Currently supported content of SVG files is:
  - Paths consisting of the commands mentioned in path_simplification.js
 */
SVG2LDRAW.Svg = function() {

}

SVG2LDRAW.Svg.prototype.toLDraw = function(svgObj) {
    var decomposition = new UTIL.TrapezoidalDecomposition(svgObj);
    decomposition.buildTrapezoids();
    // TODO: Color transformation.
    // TODO: Trapezoids to LDraw
    var ret = {width:svgObj.width, height:svgObj.height, paths:decomposition.trapezoids};

    return ret;
}