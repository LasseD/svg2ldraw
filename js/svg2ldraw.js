var SVG2LDRAW = {};

/*
  The main purpose of this library is to performs SVG to LDraw pattern transformation.
  Currently supported content of SVG files is:
  - Paths consisting of the following basic commands: M, L ('move to absolute' and 'line to absolute').
   - C, Z, H, h, V, v, m, and l commands are replaced with the basic commands using path_simplification.js
   - C commands, specifically, are replaced using bezier_removal.js

  The algorithm used to convert from SVG to LDraw is a sweep line algorithm.
  The sweep line algorithm moves a "sweep line" along the x-axis in the positive direction (left to right).
  The sweep line moves by handling events.
  Two kinds of events  exist: 'start' and 'end'. A line in a path causes a start event (left end point) and end event (right end point)

  The sweep line algorithm assumes lines are non-intersecting and points are non-overlapping.
 */
SVG2LDRAW.Svg = function(content) {
    this.content = content;
}

SVG2LDRAW.Svg.prototype.toLDraw = function(pointsPerCurve) {
    var simplifier = new UTIL.PathSimplification(pointsPerCurve);
    var svgObj = simplifier.handleSvg(this.content);

    
    // TODO Sweep line algorithm:
    return JSON.stringify(svgObj);
}