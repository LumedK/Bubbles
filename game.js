class Field {
    constructor() {
        this.game = null
        this.canvas = document.getElementById('gameField')
        this.ctx = this.canvas.getContext('2d')
        this.cursorX = 0
        this.cursorY = 0
        this.clickX = -1
        this.clickY = -1
        this.aimX = -1
        this.aimY = -1

        this.setup()
    }
    setup() {
        let canvas = this.canvas

        canvas.width = 468
        canvas.height = 480

        this.aimX = this.canvas.width / 2
        this.aimY = this.canvas.height

        canvas.addEventListener('mousemove', (event) => {
            const cursorXY = this.#getCursor(event.layerX, event.layerY)
            this.cursorX = cursorXY.x
            this.cursorY = cursorXY.y
        })

        canvas.addEventListener('click', (event) => {
            const cursorXY = this.#getCursor(event.layerX, event.layerY)
            this.clickX = cursorXY.x
            this.clickY = cursorXY.y
        })
    }

    #getCursor(layerX, layerY) {
        return {
            x: (this.canvas.width / this.canvas.offsetWidth) * layerX,
            y: (this.canvas.height / this.canvas.offsetHeight) * layerY
        }
    }

    render() {
        // console.log('render game objects')
        const canvas = this.canvas
        const ctx = this.ctx

        ctx.clearRect(0, 0, canvas.width, canvas.height)
        this.game.objects.forEach((object) => {
            if (object.isRender) {
                object.draw()
            }
        })
    }
}

class Game {
    constructor(field) {
        this.field = field
        field.game = this
        this.interval = null
        this.maxFps = 60

        this.objects = []
        this.grid = new GameObject.Grid(this)
        this.grid.addToGameObjects()
        new GameObject.AimingLine(this).addToGameObjects()

        this.lives = { max: 1, current: 1 }
        this.currentEvent = new GameEvent.AddBallLine(this)
        this.currentEvent.addLinesOfBall()
    }
    start() {
        this.interval = setInterval(this.main.bind(this), 1000 / this.maxFps)
        console.log('game started')
    }
    stop() {
        if (this.interval) {
            clearInterval(this.interval)
            console.log('game stopped')
        }
    }

    main() {
        try {
            this.currentEvent.do()
            this.field.render()
        } catch (error) {
            console.log(error)
            this.stop()
        }
    }

    deleteBalls(cells) {
        const ballsToDel = new Set([...cells].map((cell) => cell.ball))
        this.objects = this.objects.filter((obj) => !ballsToDel.has(obj))
        Array.from(cells).forEach((cell) => {
            cell.ball = null
        })
    }
}

class GameEvent {
    constructor(game) {
        this.game = game
    }
    do() {}

    static Aiming = class extends GameEvent {
        constructor(game) {
            super(game)
            this.ball = new GameObject.Ball(game) // debug
            // this.ball.type = GameObject.Ball.getTypeNumber(3)
            this.game.objects.push(this.ball)
        }
        do() {
            super.do()

            const field = this.game.field
            const wasClick = field.clickX > -1 || field.clickY > -1
            if (wasClick) {
                // prepare ball
                const ball = this.ball
                const moveVector = new Vector(
                    field.aimX,
                    field.aimY,
                    field.clickX,
                    field.clickY
                )
                moveVector.len = ball.speed
                ball.moveVector = moveVector

                // field changing
                field.clickX = -1
                field.clickY = -1

                // change event
                this.game.currentEvent = new GameEvent.CheckCollision(
                    this.game,
                    ball
                )
            }
        }
    }

    static CheckCollision = class extends GameEvent {
        constructor(game, ball) {
            super(game)
            this.ball = ball
        }
        do() {
            super.do()
            // move the ball
            const ball = this.ball
            const moveVector = ball.moveVector
            moveVector.xStart = moveVector._xEnd
            moveVector.yStart = moveVector._yEnd
            ball.x = moveVector._xEnd
            ball.y = moveVector._yEnd

            const collision = this.getCollision()

            if (!collision.type) {
                return
            } else if (collision.type === 'side') {
                this.ball.moveVector.reflectByX()
                return
            } else if (new Set(['top', 'ball']).has(collision.type)) {
                const cellForBall = collision.nearestEmptyCell
                ball.moveVector.length = 0
                cellForBall.ball = ball

                this.game.currentEvent = new GameEvent.PopSameLinkedBall(
                    this.game,
                    cellForBall
                )
            }
        }

        getCollision() {
            const grid = this.game.grid
            const ball = this.ball
            const nearestCell = grid.sortCellByDistance(
                grid.cells,
                ball.x,
                ball.y
            )[0]

            const cellsAround = grid.getCellsAround(nearestCell)
            const fillAround = []
            const emptyAround = []
            cellsAround.forEach((cell) => {
                if (cell.ball) {
                    fillAround.push(cell)
                } else {
                    emptyAround.push(cell)
                }
            })
            const nearestEmptyCell = grid.sortCellByDistance(
                emptyAround,
                ball.x,
                ball.y
            )[0]

            const collision = {
                nearestEmptyCell: nearestEmptyCell,
                type: null
            }

            if (ball.y - ball.radius <= 0) {
                collision.type = 'top'
                return collision
            }
            if (
                ball.x - ball.radius <= 0 ||
                ball.x + ball.radius >= this.game.field.canvas.width
            ) {
                collision.type = 'side'
                return collision
            }
            if (fillAround.length === 0) {
                collision.type = null
                return collision
            }
            const isFillCellInRange = fillAround.find((cell) => {
                const checkRange =
                    (cell.x - ball.x) ** 2 +
                    (cell.y - ball.y) ** 2 -
                    ball.checkRadius ** 2
                return checkRange <= 0
            })
            if (isFillCellInRange) {
                collision.type = 'ball'
                return collision
            } else {
                collision.type = null
                return collision
            }
        }
    }

    static PopSameLinkedBall = class extends GameEvent {
        constructor(game, cell) {
            super(game)
            this.cell = cell
        }
        do() {
            super.do()
            const LinkedCell = this.getLinkedCell()
            if (LinkedCell.size >= 3) {
                this.game.deleteBalls(LinkedCell)
            } else {
                --this.game.lives.current
            }

            // change event
            this.game.currentEvent = new GameEvent.PopFreeBall(this.game)
        }

        getLinkedCell(
            cell = this.cell,
            linkedCells = new Set([cell]),
            processedCells = new Set([cell])
        ) {
            const surroundingCells = cell.grid.getCellsAround(cell)
            for (let currentCell of surroundingCells) {
                if (processedCells.has(currentCell)) {
                    continue
                }
                processedCells.add(currentCell)
                if (
                    currentCell.ball &&
                    currentCell.ball.type.typeNumber ===
                        this.cell.ball.type.typeNumber
                ) {
                    linkedCells.add(currentCell)
                    this.getLinkedCell(currentCell, linkedCells, processedCells)
                }
            }
            return linkedCells
        }
    }

    static PopFreeBall = class extends GameEvent {
        constructor(game) {
            super(game)
        }
        do() {
            super.do()
            const LinkedCell = this.getLinkedCell()
            const freeBallCells = this.game.grid.cells.filter((cell) => {
                return cell.ball && !LinkedCell.has(cell)
            })
            this.game.deleteBalls(freeBallCells)

            // change event
            this.game.currentEvent = new GameEvent.CheckGameStatus(this.game)
        }

        getLinkedCell(
            cells = this.game.grid.cells.filter((cell) => {
                return cell.row === 0 && cell.ball
            }),
            linkedCells = new Set(cells),
            processedCells = new Set()
        ) {
            cells.forEach((cell) => {
                if (!processedCells.has(cell) && cell.ball) {
                    linkedCells.add(cell)
                    processedCells.add(cell)
                    const surroundingCells = cell.grid.getCellsAround(cell)
                    this.getLinkedCell(
                        surroundingCells,
                        linkedCells,
                        processedCells
                    )
                }
            })
            return linkedCells
        }
    }

    static CheckGameStatus = class extends GameEvent {
        constructor(game) {
            super(game)
        }
        do() {
            const grid = this.game.grid
            const gameOver =
                grid.cells.find((cell) => {
                    return cell.row === 18 && cell.ball
                }) != undefined
            const win =
                grid.cells.find((cell) => {
                    return cell.row === 0 && cell.ball
                }) === undefined

            if (gameOver || win) {
                alert(gameOver ? 'Game Over' : 'You WIN!!!')
                this.game.stop()
            } else {
                this.game.currentEvent = new GameEvent.AddBallLine(this.game)
            }
        }
    }

    static AddBallLine = class extends GameEvent {
        constructor(game) {
            super(game)
        }
        do() {
            const lives = this.game.lives
            if (lives.current === 0) {
                this.addLinesOfBall()

                lives.max = lives.max === 1 ? 1 : --lives.max
                lives.current = lives.max

                this.game.currentEvent = new GameEvent.PopFreeBall(this.game)
            } else {
                this.game.currentEvent = new GameEvent.Aiming(this.game)
            }
        }
        addLinesOfBall() {
            const grid = this.game.grid
            const numberRows = this.game.lives.max
            grid.cells
                .slice()
                .reverse()
                .forEach((cell) => {
                    // move balls
                    if (cell.ball) {
                        const replacingCell = grid.getCellByPosition(
                            cell.row + numberRows,
                            cell.col
                        )
                        if (replacingCell) {
                            replacingCell.ball = cell.ball
                            cell.ball = null
                        }
                    }
                    // add new line of balls
                    if (!cell.ball && cell.row < numberRows) {
                        cell.ball = new GameObject.Ball(this.game)
                        cell.ball.addToGameObjects()
                    }
                })
        }
    }
}

class GameObject {
    constructor(game) {
        this.game = game
        this.field = game.field
        this.isRender = true

        // console.log('created a new obj')
    }
    draw() {
        // console.log('draw an obj')
    }

    addToGameObjects() {
        this.game.objects.push(this)
    }

    static AimingLine = class extends GameObject {
        constructor(game) {
            super(game)
            this.aimLength = 100
        }
        draw() {
            super.draw()

            const ctx = this.field.ctx
            const cursorX = this.field.cursorX
            const cursorY = this.field.cursorY

            const aimX = this.field.aimX
            const aimY = this.field.aimY

            const aimVector = new Vector(aimX, aimY, cursorX, cursorY)

            // dev aim
            aimVector.len = 1000
            ctx.strokeStyle = 'red'
            ctx.beginPath()
            ctx.moveTo(aimX, aimY)
            ctx.lineTo(aimVector._xEnd, aimVector._yEnd)
            ctx.stroke()

            aimVector.len = this.aimLength

            ctx.strokeStyle = 'white'
            ctx.beginPath()
            ctx.moveTo(aimX, aimY)
            ctx.lineTo(aimVector._xEnd, aimVector._yEnd)
            ctx.stroke()
        }
    }

    static Ball = class extends GameObject {
        static radius = 12
        constructor(game, typeNumber = undefined) {
            super(game)
            this.x = game.field.aimX
            this.y = game.field.aimY
            this.radius = GameObject.Ball.radius
            this.moveVector = null
            this.speed = 5
            this.checkRadius = this.radius * 1.65 // should be between radius and 2 * radius
            this.type = GameObject.Ball.getTypeNumber(typeNumber)
        }

        static getTypeNumber(typeNumber = undefined) {
            const possibleColor = ['red', 'green', 'blue', 'purple', 'orange']
            if (!typeNumber) {
                const min = 0
                const max = possibleColor.length - 1
                typeNumber = Math.floor(Math.random() * (max - min + 1)) + min
            }
            return { typeNumber: typeNumber, color: possibleColor[typeNumber] }
        }

        draw() {
            super.draw()
            const ctx = this.field.ctx

            ctx.fillStyle = this.type.color
            ctx.beginPath()
            ctx.arc(this.x, this.y, this.radius, 0, 2 * Math.PI)
            ctx.fill()
        }
    }

    static Grid = class extends GameObject {
        constructor(game) {
            super(game)
            this.cells = GameObject.Grid.initCells(this)
        }

        static initCells(grid) {
            const cells = []
            const distance = GameObject.Ball.radius * 2
            let yShift = distance / 2
            for (let row = 0; row < 19; row++) {
                const xShift = (distance / 2) * ((row % 2) + 1) // (distance / 2) * ((row + 1) % 2)
                for (let col = 0; col < 19; col++) {
                    if (col * distance + xShift === 0) {
                        continue
                    }
                    const cell = new GameObject.Cell(
                        grid.game, // game
                        grid, // grid
                        col * distance + xShift, // x
                        row * distance + yShift, // y
                        row, // row
                        col // column
                    )
                    cells.push(cell)
                }
            }
            return cells
        }

        draw() {
            super.draw()
            const ctx = this.game.field.ctx

            this.cells.forEach((point) => {
                ctx.fillStyle = 'yellow'
                ctx.beginPath()
                ctx.arc(point.x, point.y, 1, 0, 2 * Math.PI)
                ctx.fill()
            })
        }

        sortCellByDistance(array, x, y, len = 1) {
            const point = { x: x, y: y }
            const r = GameObject.Ball.radius
            function getRange(cell) {
                return new Vector(point.x, point.y, cell.x, cell.y)._len
            }
            const theNearestCell = this.cells
                .filter((cell) => {
                    return (
                        Math.abs(point.x - cell.x) <= 4 * r &&
                        Math.abs(point.y - cell.y) <= 4 * r
                    )
                })
                .sort((a, b) => {
                    return getRange(a) - getRange(b)
                })
                .slice(0, len)
            return theNearestCell
        }

        getCellByPosition(row, col) {
            return this.cells.find((cell) => {
                return cell.row === row && cell.col === col
            })
        }

        getCellsAround(cell) {
            const row = cell.row
            const col = cell.col
            const cellsAround = new Set()
            cellsAround.add(this.getCellByPosition(row, col)) // current cell
            cellsAround.add(this.getCellByPosition(row, col - 1)) // left cell
            cellsAround.add(this.getCellByPosition(row, col + 1)) // right cell
            cellsAround.add(this.getCellByPosition(row - 1, col)) // top cell
            cellsAround.add(this.getCellByPosition(row + 1, col)) // bottom cell
            const shift = row % 2 === 0 ? -1 : +1
            cellsAround.add(this.getCellByPosition(row - 1, col + shift)) // top shift cell
            cellsAround.add(this.getCellByPosition(row + 1, col + shift)) // bottom shift cell

            cellsAround.delete(undefined)
            return Array.from(cellsAround)
        }
    }

    static Cell = class extends GameObject {
        constructor(game, grid, x, y, row, column) {
            super(game)
            this.grid = grid
            this.x = x
            this.y = y
            this.row = row
            this.col = column
            this._ball = null
        }
        set ball(ball) {
            if (ball instanceof GameObject.Ball) {
                ball.x = this.x
                ball.y = this.y
            }
            this._ball = ball
        }
        get ball() {
            return this._ball
        }
    }
}

class Vector {
    constructor(x1 = 0, y1 = 0, x2 = 0, y2 = 0) {
        this._xStart = x1
        this._yStart = y1
        this._xEnd = x2
        this._yEnd = y2
        this._x = x2 - x1
        this._y = y2 - y1
        this._len = Math.sqrt(this._x ** 2 + this._y ** 2)
    }
    set len(newLen) {
        let k = newLen / this._len
        k = k = 0 ? 0 : k
        this._x = this._x * k
        this._y = this._y * k
        this._xEnd = this._xStart + this._x
        this._yEnd = this._yStart + this._y
        this._len = newLen
    }
    set xStart(xNewStart) {
        this._xStart = xNewStart
        this._xEnd = this._xStart + this._x
    }
    set yStart(yNewStart) {
        this._yStart = yNewStart
        this._yEnd = this._yStart + this._y
    }
    reflectByX() {
        this._x = -this._x
        this._xEnd = this._xEnd + 2 * this._x
    }
}

const game = new Game(new Field())

// //debug
// game.currentEvent = new GameEvent.Aiming(game)
// game.currentEvent.ball.type = GameObject.Ball.getTypeNumber(3)

// let cell = null

// cell = game.grid.getCellByPosition(0, 1)
// cell.ball = new GameObject.Ball(game, 1)
// cell.ball.x = cell.x
// cell.ball.y = cell.y
// game.objects.push(cell.ball)

// cell = game.grid.getCellByPosition(0, 2)
// cell.ball = new GameObject.Ball(game, 1)
// cell.ball.x = cell.x
// cell.ball.y = cell.y
// game.objects.push(cell.ball)

// cell = game.grid.getCellByPosition(0, 10)
// cell.ball = new GameObject.Ball(game, 1)
// cell.ball.x = cell.x
// cell.ball.y = cell.y
// game.objects.push(cell.ball)

// cell = game.grid.getCellByPosition(1, 0)
// cell.ball = new GameObject.Ball(game, 3)
// cell.ball.x = cell.x
// cell.ball.y = cell.y
// game.objects.push(cell.ball)

//*****************************

// cell = game.grid.getCellByPosition(0, 1)
// cell.ball = new GameObject.Ball(game, 1)
// cell.ball.x = cell.x
// cell.ball.y = cell.y
// game.objects.push(cell.ball)

game.start()

// TODO:
// add animations
// balance lives and lines (change possible colors)
