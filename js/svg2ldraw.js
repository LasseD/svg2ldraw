var SVG2LDRAW = {};

/*
  The main purpose of this library is to performs SVG to LDraw pattern transformation.
  Currently supported content of SVG files is:
  - Paths consisting of the commands mentioned in path_simplification.js

  The algorithm used to convert from SVG to LDraw is a sweep line algorithm.
  The sweep line algorithm moves a "sweep line" along the x-axis in the positive direction (left to right).
  The sweep line moves by handling events.
  Two kinds of events  exist: 'start' and 'end'. A line in a path causes a start event (left end point) and end event (right end point)

  The sweep line algorithm assumes lines are non-intersecting and points are non-overlapping.
 */
SVG2LDRAW.Svg = function() {

}

SVG2LDRAW.Svg.prototype.toLDraw = function(svgObj) {
    
    // TODO Sweep line algorithm:
    return svgObj;
}