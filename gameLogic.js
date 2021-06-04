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

    static aimLength = 100

    static ballCheckRadius = Math.ceil(Settings.ballRadius * 1.2 * 100) / 100 // 1..2

    static ballSpeed = 10
    static maxFps = 60

    static maxLives = 4
    static gameRules = Settings.#getGameRules()

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
}

export class Message {
    static startGame = 'startGame'
    static clickOnField = 'clickOnField'
    static animationComplete = 'animationComplete'
}

class Game {
    static game = null
    constructor() {
        this.renderObjects = []
        this.grid = new GameObject.Grid(this)
        this.renderObjects.push(this.grid)
        this.renderObjects.push(new GameObject.AimingLine(this))
        this.rules = Settings.gameRules

        this.currentEvent = new GameEvent.AddBallLine(this)
        this.currentEvent.addLinesOfBall()

        this.currentBall = new GameObject.Ball(this)
        this.nextBall = new GameObject.Ball(this)
        this.nextBall.replaceToNextBallPosition()

        this.renderObjects.push(this.currentBall)
        this.renderObjects.push(this.nextBall)

        Game.game = this
    }

    getRenderObjects() {
        const result = []
        this.renderObjects.forEach((obj) => {
            result.push(obj.getRenderObject())
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

class GameEvent {
    constructor(game) {
        this.game = game
    }
    do() {}

    static Aiming = class extends GameEvent {
        constructor(game) {
            super(game)
            // this.game.field.clickX = -1
            // this.game.field.clickY = -1
        }
        do(ClickCoords) {
            // prepare ball
            const ball = this.game.currentBall
            const moveVector = new Vector(
                Settings.ballSpawnX,
                Settings.ballSpawnY,
                ClickCoords.clickX,
                ClickCoords.clickY
            )
            moveVector.len = ball.speed
            ball.moveVector = moveVector
            ball.trajectory = new Trajectory(
                this.game,
                ClickCoords.clickX,
                ClickCoords.clickY,
                moveVector
            )

            // prepare next ball
            this.game.currentBall = this.game.nextBall
            this.game.nextBall = new GameObject.Ball()
            this.game.renderObjects.push(this.game.nextBall)
            this.game.nextBall.replaceToNextBallPosition()

            // // change event
            // this.game.currentEvent = new GameEvent.CheckCollision(this.game, ball)
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
        // constructor(game, cell = null) {
        //     super(game)
        //     this.cell = cell
        //     this.linkedCellsByStep = null // array of set
        // }
        // do() {
        //     super.do()
        //     if (this.linkedCellsByStep === null) {
        //         if (this.cell != null) {
        //             // get same linked balls
        //             this.initSameBallsPopping()
        //         }
        //         if (this.cell === null) {
        //             // get free linked balls
        //             this.initFreeBallsPopping()
        //         }
        //         if (this.linkedCellsByStep != null) {
        //             this.setupPoppingAnimations()
        //         }
        //     }
        //     if (this.linkedCellsByStep === null || this.linkedCellsByStep.length === 0) {
        //         if (this.cell) {
        //             this.cell = null
        //             this.linkedCellsByStep = null
        //             // pop free cells
        //             return
        //         }
        //         // change event
        //         this.game.currentEvent = new GameEvent.CheckGameStatus(this.game)
        //         return
        //     }
        //     if (this.linkedCellsByStep.length > 0) {
        //         // remove balls with completed animation
        //         const currentStep = Array.from(this.linkedCellsByStep[0])
        //         if (this.isAnimationFinished(currentStep)) {
        //             this.game.deleteBalls(currentStep)
        //             this.linkedCellsByStep.splice(0, 1) // delete current step
        //         }
        //         return
        //     }
        // }
        // isAnimationFinished(currentStep) {
        //     return currentStep.every((cell) => {
        //         return cell.ball && cell.ball.animation === null
        //     })
        // }
        // initSameBallsPopping() {
        //     const linkedCellsByStep = this.getLinkedCellsWithSameBalls()
        //     const numberBalls = linkedCellsByStep.reduce((count, step) => {
        //         return (count += step.size)
        //     }, 0)
        //     if (numberBalls >= 3) {
        //         this.linkedCellsByStep = linkedCellsByStep
        //     } else {
        //         this.game.rules.minusLive()
        //         // --this.game.lives.current
        //     }
        // }
        // initFreeBallsPopping() {
        //     const linkedCells = this.getLinkedCellsWithFreeBalls()
        //     this.linkedCellsByStep = []
        //     this.game.grid.cells.forEach((cell) => {
        //         if (cell.ball && !linkedCells.has(cell)) {
        //             this.linkedCellsByStep.push(new Set([cell]))
        //         }
        //     })
        // }
        // setupPoppingAnimations() {
        //     let delay = 0
        //     this.linkedCellsByStep.forEach((step) => {
        //         step.forEach((cell) => {
        //             cell.ball.setPopAnimation(delay)
        //         })
        //         delay += 2
        //     })
        // }
        // getLinkedCellsWithFreeBalls(
        //     cells = this.game.grid.cells.filter((cell) => {
        //         return cell.row === 0 && cell.ball
        //     }),
        //     linkedCells = new Set(cells),
        //     processedCells = new Set()
        // ) {
        //     cells.forEach((cell) => {
        //         if (!processedCells.has(cell) && cell.ball) {
        //             linkedCells.add(cell)
        //             processedCells.add(cell)
        //             const surroundingCells = cell.grid.getCellsAround(cell)
        //             this.getLinkedCellsWithFreeBalls(surroundingCells, linkedCells, processedCells)
        //         }
        //     })
        //     return linkedCells
        // }
        // getLinkedCellsWithSameBalls(
        //     linkedCellsByStep = [new Set([this.cell])],
        //     processedCells = new Set([this.cell]),
        //     checkStack = new Map([[this.cell, 0]])
        // ) {
        //     function getStep(index) {
        //         if (linkedCellsByStep[index]) {
        //             return linkedCellsByStep[index]
        //         } else {
        //             const step = new Set()
        //             linkedCellsByStep.push(step)
        //             return step
        //         }
        //     }
        //     checkStack.forEach((stepIndex, cell) => {
        //         const step = getStep(stepIndex)
        //         step.add(cell)
        //         // get surrounding cells
        //         for (let surroundingCell of cell.grid.getCellsAround(cell)) {
        //             if (processedCells.has(surroundingCell)) {
        //                 continue
        //             }
        //             processedCells.add(surroundingCell)
        //             if (
        //                 surroundingCell.ball &&
        //                 surroundingCell.ball.type.typeID === this.cell.ball.type.typeID
        //             ) {
        //                 checkStack.set(surroundingCell, stepIndex + 1)
        //             }
        //         }
        //     })
        //     return linkedCellsByStep
        // }
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
                        this.game.renderObjects.push(newBall)
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

export class GameObject {
    constructor(game) {
        this.game = game
    }

    static AimingLine = class extends GameObject {
        constructor(game) {
            super(game)
        }

        static render(renderObject, Field) {
            const ctx = Field.ctx

            const cursorX = Field.cursorX
            const cursorY = Field.cursorY

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
            super(game)
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

        static render(renderObject, Field) {
            const ctx = Field.ctx

            ctx.drawImage(
                Field.images.get(renderObject.imageName),
                renderObject.x - renderObject.radius,
                renderObject.y - renderObject.radius,
                2 * renderObject.radius,
                2 * renderObject.radius
            )

            if (renderObject.trajectory) {
                const step = renderObject.trajectory[0]
                if (step) {
                    step.x += step.dx
                    step.y += step.dy
                    step.len -= 1

                    renderObject.x = step.x
                    renderObject.y = step.y

                    if (step.len === 0) {
                        renderObject.trajectory.shift()
                    }
                }
                if (renderObject.trajectory.len === 0) {
                    renderObject.trajectory = undefined
                }
            }
        }

        getRenderObject() {
            return {
                type: 'Ball',
                x: this.x,
                y: this.y,
                radius: this.radius,
                imageName: this.type.imageName,
                trajectory: Boolean(this.trajectory)
                    ? this.trajectory.getObjectForMessage()
                    : undefined
            }
        }

        replaceToNextBallPosition() {
            this.x = Settings.nextBallSpawnX
            this.y = Settings.nextBallSpawnY
        }
    }

    static Grid = class extends GameObject {
        constructor(game) {
            super(game)
            this.cellByRow = []
            this.cells = GameObject.Grid.initCells(this)
        }

        static initCells(grid) {
            const cells = []
            const r = Settings.ballRadius
            for (let row = 0; row <= Settings.rows; row++) {
                const line = []
                for (let col = 0; col < Settings.columns; col++) {
                    const x = r * (2 * col + 1 + (row % 2))
                    const y = r * (2 * row + 1)
                    const cell = new GameObject.Cell(
                        grid.game, // game
                        grid, // grid
                        x, // x
                        y, // y
                        row, // row
                        col // column
                    )
                    cells.push(cell)
                    line.push(cell)
                }
                grid.cellByRow.push(line)
            }
            return cells
        }

        static render(renderObject, Field) {
            const ctx = Field.ctx
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
        this._xEnd = this._xStart + this.dx
    }

    set yStart(yNewStart) {
        this._yStart = yNewStart
        this._yEnd = this._yStart + this.dy
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
        this._x = -this._x
        this._xEnd = this._xEnd + 2 * this._x
    }

    copy() {
        return new Vector(this._xStart, this._yStart, this._xEnd, this._yEnd)
    }
}

class Trajectory {
    constructor(game, clickX, clickY, startVector) {
        this.trajectory = Trajectory.initiate(game, clickX, clickY, startVector)
    }

    static Step = class {
        constructor(vector) {
            this.x = vector._xStart
            this.y = vector._yStart
            this.len = Math.ceil(vector._len / Settings.ballSpeed)
            vector.len = Settings.ballSpeed
            this.dx = vector.dx
            this.dy = vector.dy
        }
    }

    static initiate(game, cX, cY, sV, trajectory = []) {
        const aX = Settings.ballSpawnX
        const aY = Settings.ballSpawnY
        const vector = sV.copy()

        let x = 0 // final coords
        let y = 0

        // check ball collision
        // check empty cell around of fill cells
        const possibleCells = new Map() // key - y of cell, value - set of empty cells
        const fillCells = game.grid.cells.filter((cell) => Boolean(cell.ball))
        for (const cell of fillCells) {
            const emptyCells = game.grid.getCellsAround(cell).filter((cell) => !Boolean(cell.ball))
            emptyCells.forEach((cell) => {
                let setOfCells = possibleCells.get(cell.y)
                setOfCells = Boolean(setOfCells) ? setOfCells : new Set()
                setOfCells.add(cell)
                possibleCells.set(cell.y, setOfCells)
            })
        }
        // add empty cells from 1 line
        game.grid.cellByRow[0].forEach((cell) => {
            if (!cell.ball) {
                let setOfCells = possibleCells.get(cell.y)
                setOfCells = Boolean(setOfCells) ? setOfCells : new Set()
                possibleCells.set(cell.y, setOfCells)
            }
        })

        const sortedPossibleCells = new Map([...possibleCells].sort((a, b) => Boolean(a[0] - b[0])))
        const checkRadius = Settings.ballCheckRadius

        for (const elem of sortedPossibleCells) {
            y = elem[0]
            const row = elem[1]

            vector.yEnd = y
            x = vector._xEnd
            if (!(Settings.ballRadius < x < Settings.fieldWidth - Settings.ballRadius)) {
                break
            }

            for (const cell of row) {
                if (cell.x - checkRadius < x && x < cell.x + checkRadius) {
                    const step = new Trajectory.Step(vector)
                    trajectory.push(step)
                    return trajectory
                }
            }
        }

        // check left side
        if (aX - cX < 0) {
            x = Settings.ballRadius
            vector.xEnd = x
            y = vector._yEnd
            if (Settings.fieldHeight < y && y < Settings.ballRadius) {
                const step = new Trajectory.Step(vector)
                trajectory.push(step)

                sV.reflectByX()
                sV.xStart = vector._xEnd
                sV.yStart = vector._yEnd

                return Trajectory.initiate(game, sV._xEnd, sV._yEnd, sV, (trajectory = []))
            }
        }
        // right side
        if (aX - cX > 0) {
            x = Settings.fieldHeight - Settings.ballRadius
            vector.xEnd = x
            y = vector._yEnd
            if (Settings.fieldHeight < y && y < Settings.ballRadius) {
                const step = new Trajectory.Step(vector)
                trajectory.push(step)

                sV.reflectByX()
                sV.xStart = vector._xEnd
                sV.yStart = vector._yEnd

                return Trajectory.initiate(game, sV._xEnd, sV._yEnd, sV, (trajectory = []))
            }
        }

        return []
    }

    getObjectForMessage() {
        const trajectory = []
        this.trajectory.forEach((step) => {
            trajectory.push({
                x: step.x,
                y: step.y,
                len: step.len,
                dx: step.dx,
                dy: step.dy
            })
        })
        return trajectory
    }
}

function getRandomInt(min = 0, max = 10) {
    return Math.floor(Math.random() * (max - min + 1)) + min
}

onmessage = function (event) {
    let game = Game.game
    const action = event.data.message
    const parameter = event.data.parameter

    if (action === Message.startGame) {
        game = new Game()
        game.currentEvent.do() // add lines of ball
    } else if (action === Message.clickOnField && game.currentEvent instanceof GameEvent.Aiming) {
        game.currentEvent.do(parameter) // aiming
    }

    postMessage(game.getRenderObjects())
}
