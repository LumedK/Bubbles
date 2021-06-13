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
    })()
}

export class Message {
    constructor(action, attachment = undefined) {
        if (!this.constructor.actions.has(action)) {
            throw 'Unexpected action in the message'
        }

        this.action = action
        this.attachment = attachment

        if (this.constructor.worker) {
            this.constructor.worker.onmessage = this.constructor.onmessage
        }
    }

    static actions = new Set(['start_game', 'on_click', 'animation_complete', 'to_render'])
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
        this.objects = new Set()
        new GameObject.AimingLine(this)

        this.grid = new GameObject.Grid(this)
        this.rules = Settings.gameRules

        this.currentEvent = new GameEvent.AddBallLine(this)
        this.currentEvent.addLinesOfBall()

        this.nextBall = new GameObject.Ball(this)
        this.nextBall.replaceToNextBallPosition()
        this.currentBall = new GameObject.Ball(this)
    }

    getRenderObjects() {
        const result = []
        this.objects.forEach((object) => {
            if (object.isRender) {
                result.push(object.getRenderObject())
            }
        })
        return result
    }

    // deleteBalls(cells) {
    //     const ballsToDel = new Set([...cells].map((cell) => cell.ball))
    //     this.objects = this.objects.filter((obj) => !ballsToDel.has(obj))
    //     Array.from(cells).forEach((cell) => {
    //         cell.ball = null
    //     })
    // }
}

export class GameObject {
    constructor(game, isRender = false) {
        this.game = game
        this.isRender = isRender
        this.game.objects.add(this)
    }

    static AimingLine = class extends GameObject {
        constructor(game) {
            super(game, true)
        }

        static render(renderObject, field) {
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
            ctx.lineTo(aimVector._xEnd, aimVector._yEnd)
            ctx.stroke()

            aimVector.len = Settings.aimLength

            ctx.strokeStyle = 'white'
            ctx.beginPath()
            ctx.moveTo(ballSpawnX, ballSpawnY)
            ctx.lineTo(aimVector._xEnd, aimVector._yEnd)
            ctx.stroke()
        }
        getRenderObject() {
            return {
                type: 'AimingLine'
            }
        }
    }

    static Ball = class extends GameObject {
        constructor(game, typeID = undefined) {
            super(game, true)
            this.x = Settings.ballSpawnX
            this.y = Settings.ballSpawnY
            this.radius = Settings.ballRadius
            this.moveVector = null
            this.speed = Settings.ballSpeed
            this.checkRadius = Settings.ballCheckRadius
            this.type = GameObject.Ball.getType(typeID)
            this.trajectory = undefined
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

        static render(renderObject, field, image) {
            const ctx = field.ctx
            let sizeMultiplier = 1

            if (renderObject.trajectory) {
                const step = renderObject.trajectory[0]
                if (step) {
                    step.x += step.dx
                    step.y += step.dy
                    step.size += step.dSize

                    image = step.image ? step.image : image
                    sizeMultiplier = step.size ? step.size : sizeMultiplier

                    step.length -= 1

                    renderObject.x = step.x
                    renderObject.y = step.y

                    if (step.length === 0) {
                        renderObject.trajectory.shift()
                    }
                }
                if (renderObject.trajectory.length === 0) {
                    renderObject.trajectory = undefined
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

        getRenderObject() {
            return {
                type: 'Ball',
                x: this.x,
                y: this.y,
                radius: this.radius,
                imageName: this.type.imageName,
                trajectory: this.trajectory?.getRenderObject()
            }
        }

        replaceToNextBallPosition() {
            this.x = Settings.nextBallSpawnX
            this.y = Settings.nextBallSpawnY
        }
    }

    static Grid = class extends GameObject {
        constructor(game) {
            super(game, true)
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
                        game: this.game,
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

        getRenderObject() {
            const renderCells = []
            this.cells.forEach((cell) => {
                renderCells.push({ x: cell.x, y: cell.y })
            })
            return { type: 'Grid', cells: renderCells }
        }
    }

    static Cell = class extends GameObject {
        constructor({ game, grid, x, y, row, column }) {
            super(game)
            this.grid = grid
            this.x = x
            this.y = y
            this.row = row
            this.column = column
            this._ball = undefined
            this.ball = undefined // set ball

            this.grid.cells.push(this)
            this.grid.matrix[row].push(this)
        }

        set ball(ball) {
            this._ball = ball
            if (ball) {
                this.grid.fillCells.add(this)
                this.grid.emptyCells.delete(this)
                this._ball.x = this.x
                this._ball.y = this.y
            } else {
                this.grid.fillCells.delete(this)
                this.grid.emptyCells.add(this)
            }
        }

        get ball() {
            return this._ball
        }
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
            ball.trajectory = new Trajectory(this.game, moveVector)

            // prepare next ball
            this.game.currentBall = this.game.nextBall
            this.game.nextBall = new GameObject.Ball(this.game)
            this.game.nextBall.replaceToNextBallPosition()

            // change event
            const nextGameEvent = new GameEvent.Popping(this.game, ball.cell)
            this.game.currentEvent = new GameEvent.WaitAnimation(this.game, nextGameEvent)
        }
    }

    static WaitAnimation = class extends GameEvent {
        constructor(game, nextGameEvent) {
            super(game)
            this.nextGameEvent = nextGameEvent
        }
        do() {
            this.game.currentEvent = this.nextGameEvent
        }
    }

    static CheckCollision = class extends GameEvent {
        // constructor(game, ball) {
        //     super(game)
        //     this.ball = ball
        // }
        // do() {
        //     super.do()
        //     // move the ball
        //     const ball = this.ball
        //     const moveVector = ball.moveVector
        //     moveVector.xStart = moveVector._xEnd
        //     moveVector.yStart = moveVector._yEnd
        //     ball.x = moveVector._xEnd
        //     ball.y = moveVector._yEnd
        //     const collision = this.getCollision()
        //     if (!collision.type) {
        //         return
        //     } else if (collision.type === 'side') {
        //         this.ball.moveVector.reflectByX()
        //         return
        //     } else if (new Set(['top', 'ball']).has(collision.type)) {
        //         const cellForBall = collision.nearestEmptyCell
        //         ball.moveVector.length = 0
        //         cellForBall.ball = ball
        //         // this.game.currentEvent = new GameEvent.PopSameLinkedBall(this.game, cellForBall)
        //         this.game.currentEvent = new GameEvent.Popping(this.game, cellForBall)
        //     }
        // }
        // getCollision() {
        //     const grid = this.game.grid
        //     const ball = this.ball
        //     const nearestCell = grid.sortCellByDistance(grid.cells, ball.x, ball.y)[0]
        //     const cellsAround = grid.getCellsAround(nearestCell)
        //     const fillAround = []
        //     const emptyAround = []
        //     cellsAround.forEach((cell) => {
        //         if (cell.ball) {
        //             fillAround.push(cell)
        //         } else {
        //             emptyAround.push(cell)
        //         }
        //     })
        //     const nearestEmptyCell = grid.sortCellByDistance(emptyAround, ball.x, ball.y)[0]
        //     const collision = {
        //         nearestEmptyCell: nearestEmptyCell,
        //         type: null
        //     }
        //     if (ball.y - ball.radius <= 0) {
        //         collision.type = 'top'
        //         return collision
        //     }
        //     if (ball.x - ball.radius <= 0 || ball.x + ball.radius >= this.game.field.canvas.width) {
        //         collision.type = 'side'
        //         return collision
        //     }
        //     if (fillAround.length === 0) {
        //         collision.type = null
        //         return collision
        //     }
        //     const isFillCellInRange = fillAround.find((cell) => {
        //         const checkRange =
        //             (cell.x - ball.x) ** 2 + (cell.y - ball.y) ** 2 - ball.checkRadius ** 2
        //         return checkRange <= 0
        //     })
        //     if (isFillCellInRange) {
        //         collision.type = 'ball'
        //         return collision
        //     } else {
        //         collision.type = null
        //         return collision
        //     }
        // }
    }

    static Popping = class extends GameEvent {
        constructor(game, cell = undefined) {
            super(game)
            this.cell = cell
            this.linkedCellsByStep = null // array of set
        }
        do() {
            if (this.cell) {
                this.initSameBallsPopping()
            } else {
                this.initFreeBallsPopping()
            }

            // set animation
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
        // constructor(game) {
        //     super(game)
        // }
        // do() {
        //     const grid = this.game.grid
        //     const gameOver =
        //         grid.cells.find((cell) => {
        //             return cell.row === 18 && cell.ball
        //         }) != undefined
        //     const win =
        //         grid.cells.find((cell) => {
        //             return cell.row === 0 && cell.ball
        //         }) === undefined
        //     if (gameOver || win) {
        //         alert(gameOver ? 'Game Over' : 'You WIN!!!')
        //         this.game.stop()
        //     } else {
        //         this.game.currentEvent = new GameEvent.AddBallLine(this.game)
        //     }
        // }
        // checkPossibleBallType() {
        //     const possibleTypes = GameObject.Ball.possibleTypes
        //     const typesMap = new Map()
        //     // fill types map
        //     possibleTypes.forEach((type) => {
        //         typesMap.set(type.imageName, 0)
        //     })
        //     // count types
        //     this.game.grid.cells.forEach((cell) => {
        //         if (cell.ball) {
        //             const imageName = cell.ball.type.imageName
        //             typesMap[imageName] += 1
        //         }
        //     })
        //     // clear unused types
        //     typesMap.forEach((value, key) => {
        //         if (value === 0) {
        //             GameObject.Ball.possibleTypes.delete(key)
        //         }
        //     })
        // }
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
                        const newBall = new GameObject.Ball(this.game, typesIDList.shift())
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
}

class Vector {
    constructor(x1 = 0, y1 = 0, x2 = 0, y2 = 0) {
        this._xStart = x1
        this._yStart = y1
        this._xEnd = x2
        this._yEnd = y2
        this._len = Math.sqrt(this.dx ** 2 + this.dy ** 2)
    }

    get dx() {
        return this._xEnd - this._xStart
    }

    get dy() {
        return this._yEnd - this._yStart
    }

    set len(newLen) {
        const k = newLen / this._len
        this._xEnd = this._xStart + this.dx * k
        this._yEnd = this._yStart + this.dy * k
        this._len = newLen
    }

    set xStart(xNewStart) {
        this._xStart = xNewStart
        this._xEnd = this._xStart - this.dx
    }

    set yStart(yNewStart) {
        this._yStart = yNewStart
        this._yEnd = this._yStart - this.dy
    }

    set yEnd(yNewEnd) {
        if (this.dy === 0) {
            return
        }
        const k = this.dy / (yNewEnd - this._yStart)
        this._xEnd = this.dx / k + this._xStart
        this._yEnd = yNewEnd
        this._len = Math.sqrt(this.dx ** 2 + this.dy ** 2)
    }

    set xEnd(xNewEnd) {
        if (this.dx === 0) {
            return
        }
        const k = this.dx / (xNewEnd - this._xStart)
        this._yEnd = this.dy / k + this._yStart
        this._xEnd = xNewEnd
        this._len = Math.sqrt(this.dx ** 2 + this.dy ** 2)
    }

    reflectByX() {
        // this._x = -this._x
        // this._xEnd = this._xEnd + 2 * this._x
        this._xEnd = this._xEnd - 2 * this.dx
    }

    copy() {
        return new Vector(this._xStart, this._yStart, this._xEnd, this._yEnd)
    }
}

class Trajectory {
    constructor(game, startVector) {
        this.game = game
        this.trajectory = []
        this.cell = undefined
        this.initiate(startVector.copy())
    }

    static Step = class {
        constructor(trajectory, vector) {
            this.x = vector._xStart
            this.y = vector._yStart
            this.length = Math.ceil(vector._len / Settings.ballSpeed)
            vector.len = Settings.ballSpeed
            this.dx = vector.dx
            this.dy = vector.dy
            this.size = 1
            this.dSize = -0.1

            trajectory.push(this)
        }
    }

    initiate(vector, possibleCells = undefined) {
        const ballRadius = Settings.ballRadius
        const ballCheckRadius = Settings.ballCheckRadius
        const grid = this.game.grid
        const xStart = vector._xStart
        const yStart = vector._yStart
        const xClick = vector._xEnd
        let x = undefined
        let y = undefined

        if (!possibleCells) {
            // get a possible cells
            const firstRowIndex =
                grid.matrix.filter((rowList) => Boolean(rowList[0].y <= yStart)).pop()[0].row + 1
            possibleCells = grid.matrix.slice(0, firstRowIndex + 1).map(() => new Set())
            const checkingCells = new Set(grid.matrix[0].concat(Array.from(grid.fillCells)))
            for (let cell of checkingCells) {
                for (let adjacentCell of grid.getCellsAround(cell)) {
                    if (adjacentCell.row > firstRowIndex) continue
                    else if (adjacentCell.ball) checkingCells.add(adjacentCell)
                    else possibleCells[adjacentCell.row].add(adjacentCell)
                }
            }
        }

        // check hitting a cell
        for (let line of possibleCells.reverse()) {
            if (line.size === 0) continue
            x = undefined
            for (let cell of line) {
                if (!x) {
                    // set end point of vector
                    vector.yEnd = cell.y
                    x = vector._xEnd
                }
                const outSide = ballRadius > x || x > Settings.fieldWidth - ballRadius
                const outCheck = cell.x + ballCheckRadius < x || x < cell.x - ballCheckRadius
                if (outSide) break
                if (outCheck) continue

                const pullVector = new Vector(vector._xEnd, vector._yEnd, cell.x, cell.y)
                new Trajectory.Step(this.trajectory, vector.copy()) // move the ball to the row
                new Trajectory.Step(this.trajectory, pullVector) // move the ball to the cell
                this.cell = cell
                return
            }
        }

        // check sides
        const outLeft = xStart - xClick > 0
        const outRight = xStart - xClick < 0
        if (outLeft || outRight) {
            x = outLeft ? Settings.ballRadius : Settings.fieldWidth - Settings.ballRadius
            vector.xEnd = x
            y = vector._yEnd
            const outSide = vector.dy >= 0
            if (outSide) return
            new Trajectory.Step(this.trajectory, vector)
            vector.xStart = x
            vector.yStart = y
            vector.reflectByX()
            this.initiate(vector, possibleCells)
        }
    }

    getRenderObject() {
        const trajectory = []
        this.trajectory.forEach((step) => {
            trajectory.push({
                x: step.x,
                y: step.y,
                length: step.length,
                dx: step.dx,
                dy: step.dy,
                size: step.size,
                dSize: step.dSize
            })
        })
        return trajectory
    }
}

function getRandomInt(min = 0, max = 10) {
    return Math.floor(Math.random() * (max - min + 1)) + min
}

let game = undefined

onmessage = function (event) {
    const { action, attachment } = event.data

    switch (true) {
        case action === 'start_game':
            game = new Game()
            game.currentEvent.do()
            break
        case action === 'on_click':
        case game.currentEvent instanceof GameEvent.Aiming:
            game.currentEvent.do(attachment)
            break
        case action === 'animation_complete':
        case game.currentEvent instanceof GameEvent.WaitAnimation:
            game.currentEvent.do(attachment) // complete wait event
            game.currentEvent.do(attachment) // do next event
            break
        default:
            return
    }

    postMessage(new Message('to_render', game.getRenderObjects()))
}
