const canvas = document.getElementById('gameField')
const ctx = canvas.getContext('2d')
canvas.width = 500
canvas.height = 500

x1 = 250
y1 = 500

x2 = 100
y2 = 250

dx = (canvas.width / (y1 - y2)) * (x2 - x1)
x = canvas.width / 2 + dx

console.log(dx)
console.log(x)

ctx.strokeStyle = 'red'
ctx.beginPath()
ctx.moveTo(x1, y1)
ctx.lineTo(x, 0)
ctx.stroke()

ctx.strokeStyle = 'white'
ctx.beginPath()
ctx.moveTo(x1, y1)
ctx.lineTo(x2, y2)
ctx.stroke()
