export class Settings {
    static columns = 17
    static rows = 17
    static ballRadius = 24

    static fieldWidth = Settings.ballRadius * (2 * Settings.columns + 1)
    static fieldHeight = Settings.ballRadius * (2 * Settings.rows + 1) + 200

    static ballSpawnX = Settings.fieldWidth / 2 + 0.5 * Settings.ballRadius
    static ballSpawnY = Settings.fieldHeight - 100
    static nextBallSpawnX = Settings.ballSpawnX + 40
    static nextBallSpawnY = Settings.ballSpawnY + 40

    static ballCheckRadius = Math.ceil(Settings.ballRadius * 1.2 * 100) / 100 // 1..2
    static ballSpeed = 10
    static maxFps = 60

    static aimLength = 100

    static maxLives = 4
    static gameRules = (() => {
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
                this.currentLives =
                    this.currentLives < 0 ? 0 : this.currentLives - 1
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
                return addLineRule[GameObject.Ball.possibleTypes.length - 1][
                    this.maxLives - 1
                ]
            }
        }
    })()
}

export class Message {
    constructor(actionsList, attachment = undefined) {
        if (!Array.isArray(actionsList)) {
            actionsList = [actionsList]
        }
        const possibleActions = this.constructor.actions
        actionsList.forEach((action) => {
            if (!possibleActions.has(action))
                throw 'Unexpected action in the message'
        })

        this.actionsList = actionsList
        this.attachment = attachment

        if (this.constructor.worker) {
            this.constructor.worker.onmessage = this.constructor.onmessage
        }
    }

    static actions = new Set([
        undefined,
        'start_game',
        'on_click',
        'animation_complete'
    ])
    static worker = undefined
    static onmessage = undefined

    post() {
        if (!this.constructor.worker) throw 'The worker is undefined'
        if (!this.constructor.onmessage) throw 'The handler is undefined'

        this.constructor.worker.postMessage(this)
    }
}

class Game {
    constructor() {
        GameObject.game = this
        GameEvent.game = this

        this.renderObjects = new Set()
        this.rules = Settings.gameRules

        new GameObject.AimingLine()
        this.grid = new GameObject.Grid()

        this.currentEvent = new GameEvent.AddBallLine()
        this.currentEvent.addLinesOfBall()

        this.currentBall = new GameObject.Ball()
        this.currentBall.replaceToAimPosition()
        this.nextBall = new GameObject.Ball()
    }

    getRenderData() {
        const result = []
        this.renderObjects.forEach((object) => {
            if (object.isRender) {
                result.push(object.getRenderData())
            }
        })
        return result
    }

    run(renderResponse) {
        const renderAction = renderResponse?.RenderAction
        const attachment = renderResponse?.attachment

        if (renderAction && game.currentEvent instanceof WaitingRender) {
            game.currentEvent.do() // complete 'WaitingRender' game event
        }

        while (!game.currentEvent instanceof WaitingRender) {
            game.currentEvent.do(attachment)
        }
        if (game.currentEvent instanceof WaitingRender) {
            //postMessage(new Message(waitingForRenderActions, game.getRenderData()))
        }
    }

    // destroyBalls(cells) {
    //     cells.forEach((cell) => {
    //         if (this.renderObjects.has(cell.ball)) {
    //             this.renderObjects.delete(cell.ball)
    //         }
    //         cell.ball = undefined
    //     })

    // const ballsToDel = new Set([...cells].map((cell) => cell.ball))
    // this.renderObjects.forEach((cell) => {
    //     if (this.renderObjects.has(cell)) {
    //         this.renderObjects.delete(cell)
    //     }
    // })

    // this.objects = this.renderObjects.filter((obj) => !ballsToDel.has(obj))
    // Array.from(cells).forEach((cell) => {
    //     cell.ball = undefined
    // })
    // }
}

// GAME OBJECTS
export class GameObject {
    static game = undefined
    constructor(game = GameObject.game) {
        if (!game) throw "Can't create GameObject 'game' is undefined"
        this.game = game
        GameObject.game = game
    }

    static addSubClass() {
        const subClassName = this.prototype.constructor.name
        const SubClass = this
        GameObject[subClassName] = SubClass
    }
}

class RenderObject extends GameObject {
    static #addSubClass = super.addSubClass()

    constructor() {
        super()
        this.isRender = true
        this.game.renderObjects.add(this)
    }
}

class AimingLine extends GameObject.RenderObject {
    static #addSubClass = super.addSubClass()

    constructor() {
        super()
    }

    getRenderData() {
        return {
            type: 'AimingLine'
        }
    }

    static render(renderData, field) {
        const ctx = field.ctx

        const cursorX = field.cursorX
        const cursorY = field.cursorY
        const ballSpawnX = Settings.ballSpawnX
        const ballSpawnY = Settings.ballSpawnY

        const aimVector = new Vector(ballSpawnX, ballSpawnY, cursorX, cursorY)

        // dev aim
        aimVector.len = 1000
        ctx.strokeStyle = 'red'
        ctx.beginPath()
        ctx.moveTo(ballSpawnX, ballSpawnY)
        ctx.lineTo(aimVector.xEnd, aimVector.yEnd)
        ctx.stroke()

        aimVector.len = Settings.aimLength

        ctx.strokeStyle = 'white'
        ctx.beginPath()
        ctx.moveTo(ballSpawnX, ballSpawnY)
        ctx.lineTo(aimVector.xEnd, aimVector.yEnd)
        ctx.stroke()
    }
}

class Ball extends GameObject.RenderObject {
    static #addSubClass = super.addSubClass()

    constructor(typeID = undefined) {
        super()
        this.x = Settings.nextBallSpawnX
        this.y = Settings.nextBallSpawnY
        this.radius = Settings.ballRadius
        this.moveVector = undefined
        this.speed = Settings.ballSpeed
        this.type = GameObject.Ball.getType(typeID)
        this.animation = undefined
    }

    static possibleTypes = [
        'ball_1',
        'ball_2',
        'ball_3',
        'ball_4',
        'ball_5',
        'ball_6'
    ]

    static getType(typeID) {
        if (typeID === undefined) {
            typeID = getRandomInt(0, GameObject.Ball.possibleTypes.length - 1)
        }
        return {
            typeID: typeID,
            typeName: GameObject.Ball.possibleTypes[typeID]
        }
    }

    static render(renderObject, field, image) {
        const ctx = field.ctx
        let sizeMultiplier = 1

        if (renderObject.animation) {
            const step = renderObject.animation[0]
            if (step) {
                this[step.animationProcessor](step, renderObject, field, image)

                if (step.complete) {
                    renderObject.animation.shift()
                }
            }
            if (renderObject.animation.length === 0) {
                renderObject.animation = undefined
            }
        }

        ctx.drawImage(
            image,
            renderObject.x - renderObject.radius * sizeMultiplier,
            renderObject.y - renderObject.radius * sizeMultiplier,
            2 * renderObject.radius * sizeMultiplier,
            2 * renderObject.radius * sizeMultiplier
        )
    }

    getFlyAnimation() {
        function getPossibleCells(grid) {
            const possibleCells = new Set()
            const checkedCells = new Set(
                grid.matrix[0].filter((cell) => {
                    return Boolean(cell.ball)
                }) // get a cells with a ball from the first row
            )

            for (let cell of checkedCells) {
                for (let adjacentCell of grid.getCellsAround(cell)) {
                    if (adjacentCell.ball) {
                        checkedCells.add(adjacentCell)
                    } else {
                        possibleCells.add(adjacentCell)
                    }
                }
            }

            return possibleCells
        }

        function getAnimationStep(ball, vector) {
            const count = Math.ceil(vector.len / ball.speed)
            return {
                animationProcessor: 'processorFlyAnimation',
                complete: false,
                x: vector.xStart,
                y: vector.yStart,
                count: count,
                dx: vector.dx / count,
                dy: vector.dy / count
            }
        }

        const animation = []
        const grid = this.game.grid
        const possibleCells = getPossibleCells(grid)
        const vector = this.moveVector.copy()

        for (let row of grid.matrix.reverse()) {
            vector.yEnd = row[0].y
            let x = vector.xEnd
            let y = vector.yEnd

            let outLeft = x < Settings.ballRadius
            let outRight = x > Settings.fieldWidth - Settings.ballRadius

            if (outLeft || outRight) {
                x = outLeft
                    ? Settings.ballRadius
                    : Settings.fieldWidth - Settings.ballRadius
                vector.xEnd = x
                y = vector.yEnd
                if (vector.dy >= 0) return // wrong direction
                animation.push(getAnimationStep(this, vector))

                vector.xStart = x
                vector.yStart = y
                vector.reflectByX()
            } else {
                // check hitting a cell
                for (let cell of row) {
                    if (
                        !possibleCells.has(cell) ||
                        x - Settings.ballCheckRadius > cell.x ||
                        cell.x > x + Settings.ballCheckRadius
                    ) {
                        continue
                    }

                    const pullVector = new Vector(
                        vector.xEnd,
                        vector.yEnd,
                        cell.x,
                        cell.y
                    )
                    animation.push(getAnimationStep(this, vector)) // move the ball to the row
                    animation.push(getAnimationStep(this, pullVector)) // move the ball to the cell
                    this.animation = animation
                    return cell
                }
            }
        }
    }

    static processorFlyAnimation(step, renderObject, field, image) {
        step.x += step.dx
        step.y += step.dy
        step.count -= 1
        step.complete = step.count <= 0

        renderObject.x = step.x
        renderObject.y = step.y
    }

    getRenderData() {
        return {
            type: 'Ball',
            x: this.x,
            y: this.y,
            radius: this.radius,
            typeName: this.type.typeName,
            animation: this.animation
        }
    }

    replaceToAimPosition() {
        this.x = Settings.ballSpawnX
        this.y = Settings.ballSpawnY
    }
}

class Grid extends GameObject.RenderObject {
    static #addSubClass = super.addSubClass()

    constructor() {
        super()
        this.cells = []
        this.matrix = []
        this.emptyCells = new Set()
        this.fillCells = new Set()
        this.initCells()
    }

    initCells() {
        const r = Settings.ballRadius
        for (let row = 0; row <= Settings.rows; row++) {
            this.matrix[row] = []
            for (let column = 0; column < Settings.columns; column++) {
                new GameObject.Cell({
                    grid: this,
                    x: r * (2 * column + 1 + (row % 2)),
                    y: r * (2 * row + 1),
                    row: row,
                    column: column
                })
            }
        }
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
            return cell.row === row && cell.column === col
        })
    }

    getCellsAround(cell) {
        const row = cell.row
        const col = cell.column
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

    static render(renderObject, field) {
        const ctx = field.ctx
        renderObject.cells.forEach((point) => {
            ctx.fillStyle = 'white'
            ctx.beginPath()
            ctx.arc(point.x, point.y, 1, 0, 2 * Math.PI)
            ctx.fill()
        })
    }

    getRenderData() {
        const renderCells = []
        this.cells.forEach((cell) => {
            renderCells.push({ x: cell.x, y: cell.y })
        })
        return { type: 'Grid', cells: renderCells }
    }
}

class Cell extends GameObject {
    static #addSubClass = super.addSubClass()
    #ball

    constructor({ grid, x, y, row, column }) {
        super()
        this.grid = grid
        this.x = x
        this.y = y
        this.row = row
        this.column = column
        this.#ball = undefined
        this.ball = undefined

        this.grid.cells.push(this)
        this.grid.matrix[row].push(this)
    }

    set ball(ball) {
        this.#ball = ball
        if (ball) {
            this.grid.fillCells.add(this)
            this.grid.emptyCells.delete(this)
            this.#ball.x = this.x
            this.#ball.y = this.y
        } else {
            this.grid.fillCells.delete(this)
            this.grid.emptyCells.add(this)
        }
    }

    get ball() {
        return this.#ball
    }
}

// GAME EVENTS
class GameEvent {
    static game = undefined

    constructor(game = GameObject.game) {
        if (!game) throw "Can't create GameEvent 'game' is undefined"
        this.game = game
        GameObject.game = game
        this.waitingForRenderActions = []
    }

    static addSubClass() {
        const subClassName = this.prototype.constructor.name
        const SubClass = this
        GameEvent[subClassName] = SubClass
    }
}

class WaitingRender extends GameEvent {
    static #addSubClass = super.addSubClass()
    constructor(renderAction, nextGameEvent) {
        super()
        this.renderAction = renderAction
        this.nextGameEvent = nextGameEvent
    }

    do() {
        // clear animations
        this.game.renderObjects.forEach((renderObject) => {
            if (renderObject.animation) {
                renderObject.animation = undefined
            }
        })

        this.game.currentEvent = this.nextGameEvent
    }
}

class Aiming extends GameEvent {
    static #addSubClass = super.addSubClass()

    constructor() {
        super()
        this.waitingForRenderActions = ['on_click']
    }

    do(ClickCoords) {
        // prepare ball
        const ball = this.game.currentBall
        const moveVector = new Vector(
            Settings.ballSpawnX,
            Settings.ballSpawnY,
            ClickCoords.x,
            ClickCoords.y
        )
        moveVector.len = ball.speed
        ball.moveVector = moveVector
        const cell = ball.getFlyAnimation()

        // // prepare next ball
        // this.game.currentBall = this.game.nextBall
        // this.game.nextBall.replaceToAimPosition
        // this.game.nextBall = new GameObject.Ball()

        // change event
        const nextGameEvent = new GameEvent.Popping(cell)
        this.game.currentEvent = new GameEvent.WaitAnimation(nextGameEvent)
    }
}

// class WaitAnimation extends GameEvent {
//     static #addSubClass = super.addSubClass()

//     constructor(nextGameEvent) {
//         super()
//         this.nextGameEvent = nextGameEvent
//         this.waitingForRenderActions = ['animation_complete']
//     }
//     do() {
//         // clear animations
//         this.game.renderObjects.forEach((renderObject) => {
//             if (renderObject.animation) {
//                 renderObject.animation = undefined
//             }
//         })

//         this.game.currentEvent = this.nextGameEvent
//     }
// }

class Popping extends GameEvent {
    static #addSubClass = super.addSubClass()

    constructor(cell = undefined) {
        super()
        this.cell = cell
        this.linkedCellsByStep = undefined // array of set
        this.waitingForRenderActions = ['animation_complete']
    }
    do() {
        let nextEvent = undefined
        if (this.cell) {
            this.initSameBallsPopping()
            nextEvent = new Popping()
        } else {
            this.initFreeBallsPopping()
            nextEvent = new CheckGameStatus()
        }

        //this.game.currentEvent = new GameEvent.WaitAnimation(nextEvent)
        this.game.currentEvent = nextEvent

        // set animation
        this.destroyBalls()
    }

    initSameBallsPopping() {
        this.cell.ball = this.game.currentBall
        this.game.currentBall = undefined

        const linkedCellsByStep = this.getLinkedCellsWithSameBalls()
        const numberBalls = linkedCellsByStep.reduce((count, step) => {
            return (count += step.size)
        }, 0)
        if (numberBalls >= 3) {
            this.linkedCellsByStep = linkedCellsByStep
        } else {
            this.game.rules.minusLive()
        }

        this.game.currentBall = this.game.nextBall
        this.game.currentBall.replaceToAimPosition()
        this.game.nextBall = new Ball()
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
                this.getLinkedCellsWithFreeBalls(
                    surroundingCells,
                    linkedCells,
                    processedCells
                )
            }
        })
        return linkedCells
    }
    getLinkedCellsWithSameBalls() {
        const checkTypeID = this.cell.ball.type.typeID
        const linkedCellsByStep = [new Set([this.cell])]
        const processedCells = new Set([this.cell])

        for (const step of linkedCellsByStep) {
            const nextStep = new Set()
            for (let linkedCell of step) {
                for (let cell of this.game.grid.getCellsAround(linkedCell)) {
                    if (processedCells.has(cell)) continue
                    processedCells.add(cell)
                    if (cell.ball && checkTypeID === cell.ball?.type?.typeID) {
                        nextStep.add(cell)
                    }
                }
                if (nextStep.size) linkedCellsByStep.push(nextStep)
            }
        }

        return linkedCellsByStep
    }

    destroyBalls() {
        if (!this.linkedCellsByStep) return

        this.linkedCellsByStep.forEach((step) => {
            for (let cell of step) {
                if (this.game.renderObjects.has(cell.ball)) {
                    this.game.renderObjects.delete(cell.ball)
                }
                cell.ball = undefined
            }
        })
    }
}

class CheckGameStatus extends GameEvent {
    static #addSubClass = super.addSubClass()

    constructor() {
        super()
        this.waitingForRenderActions = ['animation_complete']
    }
    do() {
        const grid = this.game.grid
        const gameOver =
            grid.cells.find((cell) => {
                return cell.row === Settings.rows && cell.ball
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
            // this.game.currentEvent = new GameEvent.WaitAnimation(
            //     new GameEvent.AddBallLine(this.game)
            // )
        }
    }
    checkPossibleBallType() {
        const possibleTypes = GameObject.Ball.possibleTypes
        const typesMap = new Map()
        // fill types map
        possibleTypes.forEach((type) => {
            typesMap.set(type.typeName, 0)
        })
        // count types
        this.game.grid.cells.forEach((cell) => {
            if (cell.ball) {
                const typeName = cell.ball.type.typeName
                typesMap[typeName] += 1
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

class AddBallLine extends GameEvent {
    static #addSubClass = super.addSubClass()

    constructor(game) {
        super(game)
        this.waitingForRenderActions = ['animation_complete']
    }
    do() {
        if (this.game.rules.currentLives === 0) {
            this.addLinesOfBall()
            this.game.rules.refreshLives()

            this.game.currentEvent = new GameEvent.Popping()
        } else {
            this.game.currentEvent = new GameEvent.Aiming()
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
                    const replacingCell = grid.getCellByPosition(
                        cell.row + shiftRow,
                        cell.col
                    )
                    if (replacingCell) {
                        replacingCell.ball = cell.ball
                        cell.ball = undefined
                    }
                }
                // add new line of balls
                if (!cell.ball && cell.row < shiftRow) {
                    const newBall = new GameObject.Ball(typesIDList.shift())
                    cell.ball = newBall
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

// COMMON
export class Vector {
    #xStart
    #yStart
    #xEnd
    #yEnd
    #len

    constructor(x1 = 0, y1 = 0, x2 = 0, y2 = 0) {
        this.#xStart = x1
        this.#yStart = y1
        this.#xEnd = x2
        this.#yEnd = y2
        this.#len = Math.sqrt(this.dx ** 2 + this.dy ** 2)
    }

    get xStart() {
        return this.#xStart
    }
    get yStart() {
        return this.#yStart
    }
    get xEnd() {
        return this.#xEnd
    }
    get yEnd() {
        return this.#yEnd
    }
    get len() {
        return this.#len
    }

    get dx() {
        // the difference between the start and end point by X
        return this.#xEnd - this.#xStart
    }

    get dy() {
        // the difference between the start and end point by Y
        return this.#yEnd - this.#yStart
    }

    set len(newLen) {
        // changes the coordinates of the end point depending on the length
        const k = newLen / this.#len
        this.#xEnd = this.#xStart + this.dx * k
        this.#yEnd = this.#yStart + this.dy * k
        this.#len = newLen
    }

    set xStart(xNewStart) {
        // moves the vector to the point X
        this.#xEnd = xNewStart - this.dx
        this.#xStart = xNewStart
    }

    set yStart(yNewStart) {
        // moves the vector to the point Y
        this.#yEnd = yNewStart - this.dy
        this.#yStart = yNewStart
    }

    set yEnd(yNewEnd) {
        // sets the endpoint by X, changes the length
        if (this.dy === 0) return

        const k = this.dy / (yNewEnd - this.#yStart)
        this.#xEnd = this.dx / k + this.#xStart
        this.#yEnd = yNewEnd
        this.#len = Math.sqrt(this.dx ** 2 + this.dy ** 2)
    }

    set xEnd(xNewEnd) {
        // sets the endpoint by Y, changes the length
        if (this.dx === 0) return

        const k = this.dx / (xNewEnd - this.#xStart)
        this.#yEnd = this.dy / k + this.#yStart
        this.#xEnd = xNewEnd
        this.#len = Math.sqrt(this.dx ** 2 + this.dy ** 2)
    }

    reflectByX() {
        // reflect vector by X
        this.#xEnd = this.#xEnd - 2 * this.dx
    }

    copy() {
        return new Vector(this.#xStart, this.#yStart, this.#xEnd, this.#yEnd)
    }
}

function getRandomInt(min = 0, max = 10) {
    return Math.floor(Math.random() * (max - min + 1)) + min
}

// RUN

let game = undefined
onmessage = function (event) {
    if (!game) {
        game = new Game(event.data)
    }
    game.run()

    //***
    // const { actionsList, attachment } = event.data
    // switch (true) {
    //     case actionsList.includes('start_game'):
    //         game = new Game()
    //         game.currentEvent.do()
    //         break
    //     case actionsList.includes('on_click') &&
    //         game.currentEvent instanceof GameEvent.Aiming:
    //         game.currentEvent.do(attachment)
    //         break
    //     case actionsList.includes('animation_complete') &&
    //         game.currentEvent instanceof GameEvent.WaitAnimation:
    //         while (
    //             !(
    //                 game.currentEvent.waitingForRenderActions.includes(
    //                     'on_click'
    //                 )
    //                 // ||
    //                 // game.currentEvent.waitingForRenderActions.includes(
    //                 //     'animation_complete'
    //                 // )
    //             )
    //         ) {
    //             game.currentEvent.do(attachment)
    //         }
    //         // game.currentEvent.do(attachment) // complete the wait event
    //         // game.currentEvent.do(attachment) // pop linked ball
    //         // game.currentEvent.do(attachment) // pop free ball
    //         // game.currentEvent.do(attachment) // CheckGameStatus
    //         // if (game.currentEvent instanceof Popping) {
    //         //     game.currentEvent.do(attachment) // AddBallLine
    //         // }
    //         // if (game.currentEvent instanceof AddBallLine) {
    //         //     game.currentEvent.do(attachment) // AddBallLine
    //         //     if (game.currentEvent instanceof Popping) {
    //         //         game.currentEvent.do(attachment) // AddBallLine
    //         //     }
    //         // }
    //         // // aiming waiting for click
    //         break
    //     default:
    //         return
    // }
    // const waitingForRenderActions = game.currentEvent.waitingForRenderActions
    // postMessage(new Message(waitingForRenderActions, game.getRenderData()))
}
