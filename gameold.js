// // import { m } from './gameLogic.js'

// const backgroundTask = new Worker('gameLogic.js', { type: 'module' })

// backgroundTask.onmessage = (event) => {
//     console.log(event.data)
// }

// backgroundTask.postMessage('start')
// backgroundTask.postMessage('start1')
// backgroundTask.postMessage('start2')

// // const worker = new Worker('worker.js', { type: 'module' })
// // worker.onmessage = (event) => {
// //     console.log(event.data)
// // }

// // const canvas = document.getElementById('gameField')
// // const ctx = canvas.getContext('2d')
// // canvas.width = 500
// // canvas.height = 500

// // let fps = 0
// // let sec = new Date().getSeconds()
// // function showFPS() {
// //     const curSec = new Date().getSeconds()
// //     fps++
// //     if (sec !== curSec) {
// //         document.getElementById('fps').innerHTML = fps
// //         sec = curSec
// //         fps = 0
// //     }
// // }

// // // function doLogic(param = undefined) {
// // //     //delay
// // //     const finish = Date.now() + 100
// // //     while (Date.now() < finish) {}
// // //     return Done
// // // }

// // const ball = {
// //     x: 100,
// //     y: 100,
// //     r: 10,
// //     draw(ctx) {
// //         ctx.beginPath()
// //         ctx.arc(this.x, this.y, this.r, 0, 2 * Math.PI)
// //         ctx.fillStyle = 'green'
// //         ctx.fill()
// //     }
// // }

// // function doInterval() {
// //     // do
// //     worker.postMessage(0)
// //     // doLogic()
// //     //draw
// //     ctx.clearRect(0, 0, canvas.width, canvas.height)
// //     ball.draw(ctx)
// //     showFPS()
// // }

// // // worker
// // const worker = new Worker('worker.js', { type: 'module' })
// // worker.onmessage = (event) => {
// //     console.log(event.data)
// // }
// // // worker.postMessage(undefined)
// // // \worker

// // let interval = setInterval(doInterval, 1000 / 60)

// // export { doLogic }

//***********************************************************
class Settings {
    static columns = 17
    static rows = 17
    static ballRadius = 24

    static fieldWidth = Settings.ballRadius * (2 * Settings.columns + 1)
    static fieldHeight = Settings.ballRadius * (2 * Settings.rows + 1) + 200

    static ballCheckRadius = Math.ceil(Settings.ballRadius * 1.2 * 100) / 100 // 1..2

    static ballSpeed = 10
    static maxFps = 60

    static maxLives = 4
    static gameRules = Settings.#getGameRules()
    static images = Settings.#getImages()

    static #getGameRules() {
        return {
            maxLives: Settings.maxLives,
            currentLives: Settings.maxLives,
            minusLive() {
                if (this.currentLives - 1 === 0) {
                    --this.maxLives
                }
                if (this.maxLives === 0) {
                    this.maxLives = Settings.maxLives
                }
                this.currentLives = this.currentLives < 0 ? 0 : this.currentLives - 1
            },
            refreshLives() {
                this.currentLives = this.maxLives
            },

            get addLines() {
                const addLineRule = [
                    [1, 1, 2, 2],
                    [1, 2, 3, 4],
                    [1, 2, 3, 4],
                    [2, 3, 4, 5],
                    [3, 4, 5, 6],
                    [4, 5, 6, 7]
                ]
                return addLineRule[GameObject.Ball.possibleTypes.length - 1][this.maxLives - 1]
            }
        }
    }

    static #getImages() {
        const images = new Map()
        function getImage(path) {
            const image = new Image()
            image.src = path
            return image
        }

        images.set('ball_1', getImage('img/cat.png'))
        images.set('ball_1_pop_0', getImage('img/cat_pop0.png'))
        images.set('ball_1_pop_1', getImage('img/cat_pop1.png'))
        images.set('ball_1_pop_2', getImage('img/cat_pop2.png'))

        images.set('ball_2', getImage('img/ghost.png'))
        images.set('ball_2_pop_0', getImage('img/ghost_pop0.png'))
        images.set('ball_2_pop_1', getImage('img/ghost_pop1.png'))
        images.set('ball_2_pop_2', getImage('img/ghost_pop2.png'))

        images.set('ball_3', getImage('img/pig.png'))
        images.set('ball_3_pop_0', getImage('img/pig_pop0.png'))
        images.set('ball_3_pop_1', getImage('img/pig_pop1.png'))
        images.set('ball_3_pop_2', getImage('img/pig_pop2.png'))

        images.set('ball_4', getImage('img/pumpkin.png'))
        images.set('ball_4_pop_0', getImage('img/pumpkin_pop0.png'))
        images.set('ball_4_pop_1', getImage('img/pumpkin_pop1.png'))
        images.set('ball_4_pop_2', getImage('img/pumpkin_pop2.png'))

        images.set('ball_5', getImage('img/vampire.png'))
        images.set('ball_5_pop_0', getImage('img/vampire_pop0.png'))
        images.set('ball_5_pop_1', getImage('img/vampire_pop1.png'))
        images.set('ball_5_pop_2', getImage('img/vampire_pop2.png'))

        images.set('ball_6', getImage('img/zombie.png'))
        images.set('ball_6_pop_0', getImage('img/zombie_pop0.png'))
        images.set('ball_6_pop_1', getImage('img/zombie_pop1.png'))
        images.set('ball_6_pop_2', getImage('img/zombie_pop2.png'))

        return images
    }
}

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

        canvas.width = Settings.fieldWidth
        canvas.height = Settings.fieldHeight

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
        this.maxFps = Settings.maxFps

        this.objects = []
        this.grid = new GameObject.Grid(this)
        this.grid.addToGameObjects()
        new GameObject.AimingLine(this).addToGameObjects()

        this.rules = Settings.gameRules
        // this.lives = { max: 1, current: 1 }
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
            this.game.objects.push(this.ball)

            this.game.field.clickX = -1
            this.game.field.clickY = -1
        }
        do() {
            super.do()

            const field = this.game.field
            const wasClick = field.clickX > -1 || field.clickY > -1
            if (wasClick) {
                // prepare ball
                const ball = this.ball
                const moveVector = new Vector(field.aimX, field.aimY, field.clickX, field.clickY)
                moveVector.len = ball.speed
                ball.moveVector = moveVector

                // field changing
                field.clickX = -1
                field.clickY = -1

                // change event
                this.game.currentEvent = new GameEvent.CheckCollision(this.game, ball)
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

                // this.game.currentEvent = new GameEvent.PopSameLinkedBall(this.game, cellForBall)
                this.game.currentEvent = new GameEvent.Popping(this.game, cellForBall)
            }
        }

        getCollision() {
            const grid = this.game.grid
            const ball = this.ball
            const nearestCell = grid.sortCellByDistance(grid.cells, ball.x, ball.y)[0]

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
            const nearestEmptyCell = grid.sortCellByDistance(emptyAround, ball.x, ball.y)[0]

            const collision = {
                nearestEmptyCell: nearestEmptyCell,
                type: null
            }

            if (ball.y - ball.radius <= 0) {
                collision.type = 'top'
                return collision
            }
            if (ball.x - ball.radius <= 0 || ball.x + ball.radius >= this.game.field.canvas.width) {
                collision.type = 'side'
                return collision
            }
            if (fillAround.length === 0) {
                collision.type = null
                return collision
            }
            const isFillCellInRange = fillAround.find((cell) => {
                const checkRange =
                    (cell.x - ball.x) ** 2 + (cell.y - ball.y) ** 2 - ball.checkRadius ** 2
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

    static Popping = class extends GameEvent {
        constructor(game, cell = null) {
            super(game)
            this.cell = cell
            this.linkedCellsByStep = null // array of set
        }
        do() {
            super.do()
            if (this.linkedCellsByStep === null) {
                if (this.cell != null) {
                    // get same linked balls
                    this.initSameBallsPopping()
                }
                if (this.cell === null) {
                    // get free linked balls
                    this.initFreeBallsPopping()
                }
                if (this.linkedCellsByStep != null) {
                    this.setupPoppingAnimations()
                }
            }

            if (this.linkedCellsByStep === null || this.linkedCellsByStep.length === 0) {
                if (this.cell) {
                    this.cell = null
                    this.linkedCellsByStep = null
                    // pop free cells
                    return
                }

                // change event
                this.game.currentEvent = new GameEvent.CheckGameStatus(this.game)
                return
            }

            if (this.linkedCellsByStep.length > 0) {
                // remove balls with completed animation
                const currentStep = Array.from(this.linkedCellsByStep[0])
                if (this.isAnimationFinished(currentStep)) {
                    this.game.deleteBalls(currentStep)
                    this.linkedCellsByStep.splice(0, 1) // delete current step
                }

                return
            }
        }

        isAnimationFinished(currentStep) {
            return currentStep.every((cell) => {
                return cell.ball && cell.ball.animation === null
            })
        }

        initSameBallsPopping() {
            const linkedCellsByStep = this.getLinkedCellsWithSameBalls()
            const numberBalls = linkedCellsByStep.reduce((count, step) => {
                return (count += step.size)
            }, 0)

            if (numberBalls >= 3) {
                this.linkedCellsByStep = linkedCellsByStep
            } else {
                this.game.rules.minusLive()
                // --this.game.lives.current
            }
        }

        initFreeBallsPopping() {
            const linkedCells = this.getLinkedCellsWithFreeBalls()
            this.linkedCellsByStep = []
            this.game.grid.cells.forEach((cell) => {
                if (cell.ball && !linkedCells.has(cell)) {
                    this.linkedCellsByStep.push(new Set([cell]))
                }
            })
        }

        setupPoppingAnimations() {
            let delay = 0
            this.linkedCellsByStep.forEach((step) => {
                step.forEach((cell) => {
                    cell.ball.setPopAnimation(delay)
                })
                delay += 2
            })
        }

        getLinkedCellsWithFreeBalls(
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
                    this.getLinkedCellsWithFreeBalls(surroundingCells, linkedCells, processedCells)
                }
            })
            return linkedCells
        }

        getLinkedCellsWithSameBalls(
            linkedCellsByStep = [new Set([this.cell])],
            processedCells = new Set([this.cell]),
            checkStack = new Map([[this.cell, 0]])
        ) {
            function getStep(index) {
                if (linkedCellsByStep[index]) {
                    return linkedCellsByStep[index]
                } else {
                    const step = new Set()
                    linkedCellsByStep.push(step)
                    return step
                }
            }

            checkStack.forEach((stepIndex, cell) => {
                const step = getStep(stepIndex)
                step.add(cell)

                // get surrounding cells
                for (let surroundingCell of cell.grid.getCellsAround(cell)) {
                    if (processedCells.has(surroundingCell)) {
                        continue
                    }
                    processedCells.add(surroundingCell)
                    if (
                        surroundingCell.ball &&
                        surroundingCell.ball.type.typeID === this.cell.ball.type.typeID
                    ) {
                        checkStack.set(surroundingCell, stepIndex + 1)
                    }
                }
            })
            return linkedCellsByStep
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

        checkPossibleBallType() {
            const possibleTypes = GameObject.Ball.possibleTypes
            const typesMap = new Map()
            // fill types map
            possibleTypes.forEach((type) => {
                typesMap.set(type.imageName, 0)
            })
            // count types
            this.game.grid.cells.forEach((cell) => {
                if (cell.ball) {
                    const imageName = cell.ball.type.imageName
                    typesMap[imageName] += 1
                }
            })
            // clear unused types
            typesMap.forEach((value, key) => {
                if (value === 0) {
                    GameObject.Ball.possibleTypes.delete(key)
                }
            })
        }
    }

    static AddBallLine = class extends GameEvent {
        constructor(game) {
            super(game)
        }
        do() {
            if (this.game.rules.currentLives === 0) {
                this.addLinesOfBall()
                this.game.rules.refreshLives()

                this.game.currentEvent = new GameEvent.Popping(this.game)
            } else {
                this.game.currentEvent = new GameEvent.Aiming(this.game)
            }
        }
        addLinesOfBall() {
            const grid = this.game.grid
            const shiftRow = this.game.rules.addLines

            const typesIDList = this.getShuffledTypesIDList(shiftRow)

            grid.cells
                .slice()
                .reverse()
                .forEach((cell) => {
                    // move balls
                    if (cell.ball) {
                        const replacingCell = grid.getCellByPosition(cell.row + shiftRow, cell.col)
                        if (replacingCell) {
                            replacingCell.ball = cell.ball
                            cell.ball = null
                        }
                    }
                    // add new line of balls
                    if (!cell.ball && cell.row < shiftRow) {
                        cell.ball = new GameObject.Ball(this.game, typesIDList.shift())
                        cell.ball.addToGameObjects()
                    }
                })
        }

        getShuffledTypesIDList(shiftRow) {
            const ballsTypes = GameObject.Ball.possibleTypes
            const typesIDList = []
            // fill balls' type list
            ballsTypes.forEach((type, typeID) => {
                typesIDList.push(typeID)
            })
            const maxLength = shiftRow * Settings.columns - typesIDList.length
            for (let _ of new Array(maxLength)) {
                const randomTypeID = getRandomInt(0, ballsTypes.length - 1)
                typesIDList.push(randomTypeID)
            }
            // shuffle
            const maxIndex = typesIDList.length - 1
            typesIDList.slice().forEach((value, index) => {
                const changeIndex = getRandomInt(index, maxIndex)
                const tempValue = typesIDList[changeIndex]
                typesIDList[changeIndex] = typesIDList[index]
                typesIDList[index] = tempValue
            })
            return typesIDList
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
        static radius = Settings.ballRadius
        constructor(game, typeID = undefined) {
            super(game)
            this.x = game.field.aimX
            this.y = game.field.aimY
            this.radius = GameObject.Ball.radius
            this.moveVector = null
            this.speed = Settings.ballSpeed
            this.checkRadius = Settings.ballCheckRadius
            this.type = GameObject.Ball.getType(typeID)
            this.animation = null
        }

        static possibleTypes = ['ball_1', 'ball_2', 'ball_3', 'ball_4', 'ball_5', 'ball_6']

        static getType(typeID) {
            if (typeID === undefined) {
                typeID = getRandomInt(0, GameObject.Ball.possibleTypes.length - 1)
            }
            return {
                typeID: typeID,
                imageName: GameObject.Ball.possibleTypes[typeID]
            }
        }

        draw() {
            super.draw()
            const ctx = this.field.ctx
            let imageName = this.type.imageName

            if (this.animation != null) {
                const animation = this.animation
                const currentSlide = animation.slides[0]
                if (!currentSlide) {
                    this.animation = null
                } else if (currentSlide.frames <= 0) {
                    animation.slides.shift()
                } else {
                    --currentSlide.frames
                    imageName = currentSlide.imageName
                }
            }

            ctx.drawImage(
                Settings.images.get(imageName),
                this.x - this.radius,
                this.y - this.radius,
                2 * this.radius,
                2 * this.radius
            )
        }

        setPopAnimation(delay = 0) {
            const animation = {
                name: 'popBall',
                slides: [
                    {
                        frames: delay,
                        imageName: this.type.imageName
                    },
                    {
                        frames: 2,
                        imageName: `${this.type.imageName}_pop_0`
                    },
                    {
                        frames: 4,
                        imageName: `${this.type.imageName}_pop_1`
                    },
                    {
                        frames: 5,
                        imageName: `${this.type.imageName}_pop_2`
                    }
                ]
            }
            this.animation = animation
        }
    }

    static Grid = class extends GameObject {
        constructor(game) {
            super(game)
            this.cells = GameObject.Grid.initCells(this)
        }

        static initCells(grid) {
            const ctx = grid.game.field.ctx

            const cells = []
            const r = Settings.ballRadius
            for (let row = 0; row <= Settings.rows; row++) {
                for (let col = 0; col < Settings.columns; col++) {
                    const x = r * (2 * col + 1 + (row % 2))
                    const y = r * (2 * row + 1)
                    const cell = new GameObject.Cell(
                        grid.game, // game
                        grid, // grid
                        x, // x
                        y, // y
                        row, //
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
                        Math.abs(point.x - cell.x) <= 4 * r && Math.abs(point.y - cell.y) <= 4 * r
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

function getRandomInt(min = 0, max = 10) {
    return Math.floor(Math.random() * (max - min + 1)) + min
}

const game = new Game(new Field())
game.start()

// TODO:
//+ change possible colors
// rework collision
//  добавить линии проверки выхода за поле
//  хранить ячейки по строкам
//  переработка коллизий
//      проверять колизии шаров на каждой строке

// performance optimizations
//  оставить в интервалах только отрисовку
//  продумать способ перемещения картинки
