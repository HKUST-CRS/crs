#import "@preview/cetz:0.4.2"

#set page(width: 2.5cm, height: 2.5cm)
#set text(size: 1cm)

#place(horizon+center)[
  #cetz.canvas({
    import cetz.draw: *
    content((0.925, 0.025), text("⚙️", font: "Twitter Color Emoji"))
    content((0, 0), 
      text("CRS", font: "Metropolis", weight: "black", tracking: -0.5mm, fill: color.rgb("#003366"), stroke: 1.35mm + white))
    content((0, 0), 
      text("CRS", font: "Metropolis", weight: "black", tracking: -0.5mm, fill: color.rgb("#003366")))
  })
]