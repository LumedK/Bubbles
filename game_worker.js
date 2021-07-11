export class Settings {
    static rows = 18
    static columns = 17
    static bubbleRadius = 24
    static bubbleSpeed = 10
    static bubbleHitRange = Settings.bubbleRadius * 1.25

    static fieldWidth = Settings.bubbleRadius * (2 * Settings.columns + 1)
    static fieldHeight = Settings.bubbleRadius * (2 * Settings.rows + 1) + 200

    static bubbleSpawnX = Settings.fieldWidth / 2 + 0.5 * Settings.bubbleRadius
    static bubbleSpawnY = Settings.fieldHeight - 100
    static nextBubbleSpawnX = Settings.bubbleSpawnX + 40
    static nextBubbleSpawnY = Settings.bubbleSpawnY + 40

    static aimArrowHeight = 150
    static aimArrowWidth = 30
    static minAimAngleRad = 0.1745

    static maxFps = 60

    static maxLives = 4
    static addLineRule = [
        [1, 1, 2, 2],
        [1, 2, 3, 4],
        [1, 2, 3, 4],
        [2, 3, 4, 5],
        [3, 4, 5, 6],
        [4, 5, 6, 7]
    ] // ROW: possible balls; COLUMN: max lives; VALUE: number of adding lines
}

export function message(command = '', attachment) {
    return { command: command, attachment: attachment }
}

class Game {
    static game = undefined

    constructor() {
        RenderObjects.objects = []
        this.finished = false
        new AimArrow()
        this.aimBubble = new Bubble(Settings.bubbleSpawnX, Settings.bubbleSpawnY)
        this.nextBubble = new Bubble(Settings.nextBubbleSpawnX, Settings.nextBubbleSpawnY)
        this.lives = new Lives()
        Game.game = this
        StaticBubble.initiate()
        this.clickXY = undefined
        this.loop = this.#loop()
        AddBubblesLines.completeAction()
    }

    #loop = function* () {
        while (this && !this.finished) {
            // if (AddBubblesLines.completed()) yield 'waiting_for_click'
            ShootBubble.startAction()
            yield 'waiting_for_complete_animation'
            ShootBubble.completeAction()
        }
    }
}

class AddBubblesLines {
    static completeAction() {
        function getRandomTypeList() {
            const list = []
            if (numberOfNewBubbles === 0) return list
            const differenceTypes = new Set()
            const length = Bubble.possibleTypes.length
            for (let i = 0; i < numberOfNewBubbles; i++) {
                let type = Bubble.possibleTypes[getRandomInt(0, length - 1)]
                list.push(type)
                differenceTypes.add(type)
            }
            if (Game.game.aimBubble.type) differenceTypes.add(Game.game.aimBubble.type)

            if (differenceTypes.size !== length) return getRandomTypeList()
            return list
        }

        const numberOfAddingLines = 15 // debug
        // const numberOfAddingLines =
        //     Settings.addLineRule[Bubble.possibleTypes.length - 1][Game.game.lives.maxLives - 1]

        // Shift the bubbles
        for (let bubble of StaticBubble.bubbles.slice().reverse()) {
            if (!bubble.type) continue
            const offsetBubbleRow = bubble.row + numberOfAddingLines
            if (offsetBubbleRow > Settings.rows - 1) continue
            let offsetBubble = StaticBubble.matrix[offsetBubbleRow][bubble.column]
            if (offsetBubble.type) continue
            offsetBubble.type = bubble.type
            bubble.type = undefined
        }

        let numberOfNewBubbles = 0
        for (let bubble of StaticBubble.bubbles) {
            if (bubble.row > numberOfAddingLines - 1) break
            if (bubble.type) break
            numberOfNewBubbles += 1
        }

        // Get list of random types
        const list = getRandomTypeList()

        // Fill types of bubbles
        list.forEach((type, index) => {
            StaticBubble.bubbles[index].type = type
        })

        return true
    }
}

class ShootBubble {
    static bubble
    static staticBubble
    static wayList = []
    static startAction() {
        const aimBubble = Game.game.aimBubble
        this.bubble = new Bubble(aimBubble.x, aimBubble.y)
        this.bubble.type = aimBubble.type
        aimBubble.type = undefined

        this.bubble.animation = this.setAnimation()
    }

    static completeAction() {
        // staticBubble.type = this.bubble.type
        // this.bubble = undefined
        // staticBubble.type = undefined
        // Game.game.aimBubble.type = Game.game.nextBubble.type
        // Game.game.nextBubble.type = Bubble.getRandomType()
    }

    static addToWayList(vector) {
        const way = vector.copy()
        this.wayList.push(way)
    }

    static getWayList() {
        const clickXY = Game.game.clickXY

        let aimVector = new Vector(
            Settings.bubbleSpawnX,
            Settings.bubbleSpawnY,
            clickXY.x,
            clickXY.y
        )
        const clickAngle = aimVector.angle
        if (Math.abs(clickAngle) < Settings.minAimAngleRad) {
            aimVector.angle = Settings.minAimAngleRad * (clickAngle < 0 ? -1 : 1)
        }

        this.staticBubble = undefined
        for (let line of StaticBubble.matrix.slice().reverse()) {
            const y = line[0].y
            const x = aimVector.setEndPointByY(y).endPointX
            const outLeft = x < Settings.bubbleRadius
            const outRight = x > Settings.fieldWidth - Settings.bubbleRadius

            if (outLeft || outRight) {
                while (true) {
                    const xSidePoint = outLeft
                        ? Settings.bubbleRadius
                        : Settings.fieldWidth - Settings.bubbleRadius
                    aimVector.setEndPointByX(xSidePoint)

                    if (aimVector.endPointY <= y) break

                    this.addToWayList(aimVector)
                    aimVector.moveTo(aimVector.endPointX, aimVector.endPointY)
                    aimVector.reflectByX()
                }

                // get side point
                // reflect

                // while (true) {
                //     const xReflect = outLeft
                //         ? Settings.bubbleRadius
                //         : Settings.fieldWidth - Settings.bubbleRadius
                //     aimVector.setEndPointByX(xReflect)
                //     this.addToWayList(aimVector)
                //     aimVector.moveTo(aimVector.endPointX, aimVector.endPointY)
                //     aimVector.reflectByX()
                //     if (aimVector.endPointY <= y) break
                // }
            }

            for (let bubble of line) {
                const inBubbleArea =
                    bubble.x - Settings.bubbleRadius <= x && x <= bubble.x + Settings.bubbleRadius
                const isEmptyBubble = !bubble.type

                if (!inBubbleArea) {
                    continue
                } else if (!isEmptyBubble) {
                    aimVector.setEndPointByY(this.staticBubble.y)
                    this.addToWayList(aimVector)
                    return
                }
                // inBubbleArea && isEmptyBubble
                const isLeftBubbleInHitRange =
                    bubble.column > 0 &&
                    StaticBubble.matrix[bubble.row][bubble.column - 1].x +
                        Settings.bubbleHitRange >=
                        bubble.x

                const isRightBubbleInHitRange =
                    bubble.column < Settings.columns - 1 &&
                    StaticBubble.matrix[bubble.row][bubble.column + 1].x -
                        Settings.bubbleHitRange <=
                        bubble.x

                if (isLeftBubbleInHitRange || isRightBubbleInHitRange) {
                    this.staticBubble = bubble
                    aimVector.setEndPointByY(bubble.y)
                    this.addToWayList(aimVector)
                    return
                }

                this.staticBubble = bubble
            }
        }
    }

    static setAnimation() {
        this.getWayList()
        const lastVector = this.wayList[this.wayList.length - 1]
        this.addToWayList(
            new Vector(
                lastVector.endPointX,
                lastVector.endPointY,
                this.staticBubble.x,
                this.staticBubble.y
            )
        )

        return new RenderBubbleWayAnimation(this.wayList)
    }
}

// Renders

export class AbstractRender {
    static #init = (() => {})()
    static getRenderData() {}
    static draw() {}
}

class GameRender extends AbstractRender {
    static #init = (() => {
        AbstractRender.GameRender = GameRender
    })()

    constructor() {
        super()
        this.field
        this.interval
        this.renderDataList = []
    }
    run() {
        const field = this.field
        field.ctx.clearRect(0, 0, field.canvas.width, field.canvas.height)
        if (!this.renderDataList) return

        const renderState = { beforeRender: undefined, onRender: undefined, afterRender: undefined }
        this.constructor.beforeRender(renderState)

        for (const renderData of this.renderDataList) {
            this.constructor.onRender(renderState)
            try {
                const render = this.constructor[renderData.Render]
                render.draw(this.field, renderData)
            } catch (error) {
                console.log('render error', error)
                continue
            }
        }

        this.constructor.afterRender(renderState)
    }

    static beforeRender = function (renderState) {}
    static onRender = function (renderState) {}
    static afterRender = function (renderState) {}
}

class FPSRender extends GameRender {
    static #init = (() => {
        GameRender.FPSRender = FPSRender
        const afterRender = GameRender.afterRender
        GameRender.afterRender = function (renderState) {
            afterRender(renderState)
            FPSRender.afterRender(renderState)
        }
    })()

    static startingSecond = 0
    static counter = 0
    static HTMLElement

    static afterRender = function (renderState) {
        this.HTMLElement = this.HTMLElement ? this.HTMLElement : document.getElementById('fps')
        const currentSecond = new Date().getSeconds()
        const showFPS = this.startingSecond !== currentSecond
        if (showFPS) {
            this.HTMLElement.innerHTML = this.counter
            this.startingSecond = currentSecond
            this.counter = 0
        } else {
            this.counter++
        }
    }
}

class BubbleRender extends AbstractRender {
    static #init = (() => {
        AbstractRender.BubbleRender = BubbleRender
    })()

    static getRenderData(bubble) {
        if (!bubble.type)
            return {
                Render: 'BubbleRender',
                x: bubble.x,
                y: bubble.y,
                r: 1,
                type: 'bubble_0',
                animation: undefined
            }
        return {
            Render: 'BubbleRender',
            x: bubble.x,
            y: bubble.y,
            r: bubble.r,
            type: bubble.type,
            animation: bubble?.animation?.Render?.getRenderData(bubble.animation)
        }
    }

    static images = new Map([
        ['bubble_0', 'red'],
        ['bubble_1', 'green'],
        ['bubble_2', 'blue'],
        ['bubble_3', 'yellow'],
        ['bubble_4', 'orange'],
        ['bubble_5', 'purple']
    ])

    static draw(field, renderData) {
        if (renderData.animation) {
            AbstractRender[renderData.animation.Render].draw(field, renderData)
        }

        const ctx = field.ctx

        ctx.fillStyle = this.images.get(renderData.type)
        ctx.beginPath()
        ctx.arc(renderData.x, renderData.y, renderData.r, 0, 2 * Math.PI, false)
        ctx.fill()
    }
}

class AimArrowRender extends AbstractRender {
    static #init = (() => {
        AbstractRender.AimArrowRender = AimArrowRender
    })()

    static getRenderData(aimArrow) {
        return {
            Render: 'AimArrowRender',
            x: Settings.bubbleSpawnX,
            y: Settings.bubbleSpawnY,
            length: Settings.aimArrowLength
        }
    }

    static draw(field, renderData) {
        const ctx = field.ctx
        const image = field.Images.aim_arrow

        const dxCursor = field.cursorX - Settings.bubbleSpawnX
        const dyCursor = field.cursorY - Settings.bubbleSpawnY
        const angle = Math.atan(dxCursor / dyCursor)

        const translateX = Settings.bubbleSpawnX
        const translateY = Settings.bubbleSpawnY

        ctx.translate(translateX, translateY)
        ctx.rotate(-angle)
        ctx.drawImage(
            image,
            Settings.aimArrowWidth / 2,
            0,
            -Settings.aimArrowWidth,
            -Settings.aimArrowHeight
        )
        ctx.rotate(+angle)
        ctx.translate(-translateX, -translateY)
    }
}

class RenderBubbleWayAnimation extends AbstractRender {
    static #init = (() => {
        AbstractRender.RenderBubbleWayAnimation = RenderBubbleWayAnimation
    })()

    constructor(wayList) {
        super()
        this.Render = RenderBubbleWayAnimation
        this.wayList = wayList
    }

    static getRenderData(animation) {
        if (!animation) return undefined

        const animationData = {
            Render: 'RenderBubbleWayAnimation',
            count: 0,
            dx: 0,
            dy: 0,
            steps: []
        }
        for (let vector of animation.wayList) {
            const k = vector.length / Settings.bubbleSpeed
            const step = {
                count: Math.floor(k),
                dx: vector.dx / k,
                dy: vector.dy / k
            }
            animationData.steps.push(step)
        }

        return animationData
    }

    static draw(field, renderData) {
        const animation = renderData.animation

        if (animation.count <= 0 && animation.steps.length === 0) {
            renderData.animation = undefined
            return // animation complete
        }

        if (animation.count <= 0) {
            const step = animation.steps.shift()
            animation.count = step.count
            animation.dx = step.dx
            animation.dy = step.dy
            if (animation.count <= 0) return // step complete
        }

        renderData.x += animation.dx
        renderData.y += animation.dy
        animation.count--
    }
}

// Game objects

class RenderObjects {
    static objects = []
    constructor() {
        RenderObjects.objects.push(this)
        this.Render = AbstractRender
    }

    static getRenderData() {
        const renderDataList = []
        RenderObjects.objects.forEach((object) => {
            const renderData = object.Render.getRenderData(object)
            if (renderData) {
                renderDataList.push(object.Render.getRenderData(object))
            }
        })

        return renderDataList
    }
}

class Bubble extends RenderObjects {
    static possibleTypes = ['bubble_0', 'bubble_1', 'bubble_2', 'bubble_3', 'bubble_4', 'bubble_5']
    constructor(x, y) {
        super()
        this.Render = BubbleRender
        this.x = x
        this.y = y
        this.r = Settings.bubbleRadius
        this.type = this.constructor.getRandomType()
        this.animation = undefined
    }

    static getRandomType() {
        return Bubble.possibleTypes[getRandomInt(0, Bubble.possibleTypes.length - 1)]
    }
}

class StaticBubble extends Bubble {
    static bubbles = []
    static matrix = []

    constructor({ row, column, x, y }) {
        super(x, y)
        this.type = undefined
        this.row = row
        this.column = column
        this.r = Settings.bubbleRadius
        StaticBubble.bubbles.push(this)
        this.adjacentBubble = []

        if (!StaticBubble.matrix[row]) StaticBubble.matrix[row] = []
        StaticBubble.matrix[row][column] = this
    }

    static initiate() {
        const radius = Settings.bubbleRadius
        for (let row = 0; row <= Settings.rows; row++) {
            // StaticBubble.matrix[row] = []
            for (let column = 0; column < Settings.columns; column++) {
                new StaticBubble({
                    row: row,
                    column: column,
                    x: radius * (2 * column + 1 + (row % 2)),
                    y: radius * (2 * row + 1)
                })
            }
        }

        // get adjacent bubbles
        for (let bubble of StaticBubble.bubbles) {
            function add(bubble, row, column) {
                if (!StaticBubble.matrix[row]) return
                if (!StaticBubble.matrix[row][column]) return
                bubble.adjacentBubble.push(bubble)
            }
            add(bubble, 0, 0) // current
            add(bubble, bubble.row, bubble.column - 1) // left cell
            add(bubble, bubble.row, bubble.column + 1) // right cell
            add(bubble, bubble.row - 1, bubble.column) // top cell
            add(bubble, bubble.row - 1, bubble.column) // bottom cell
            const shift = bubble.row % 2 === 0 ? -1 : +1
            add(bubble, bubble.row - 1, bubble.column + shift) // top shift cell
            add(bubble, bubble.row - 1, bubble.column + shift) // bottom shift cell
        }
    }
}

class AimArrow extends RenderObjects {
    constructor() {
        super()
        this.Render = AimArrowRender
    }
}

// Special objects

class Lives {
    constructor() {
        this.maxLives = Settings.maxLives
        this.currentLives = Settings.maxLives
    }
}

export class Vector {
    #xStart
    #yStart
    #xEnd
    #yEnd
    #length

    constructor(x1 = 0, y1 = 0, x2 = 0, y2 = 0) {
        this.#xStart = x1
        this.#yStart = y1
        this.#xEnd = x2
        this.#yEnd = y2
        this.#length = Math.sqrt(this.dx ** 2 + this.dy ** 2)
    }

    get x() {
        return this.#xStart
    }
    get y() {
        return this.#yStart
    }
    get dx() {
        // the difference between the start and end point by X
        return this.#xEnd - this.#xStart
    }
    get dy() {
        // the difference between the start and end point by Y
        return this.#yEnd - this.#yStart
    }
    get endPointX() {
        return this.#xEnd
    }
    get endPointY() {
        return this.#yEnd
    }
    get length() {
        return this.#length
    }
    get angle() {
        return Math.atan(this.dy / this.dx)
    }
    set angle(newAngle) {
        this.#xEnd = Math.cos(newAngle) * this.length + this.#xStart
        this.#yEnd = Math.sin(newAngle) * this.length + this.#yStart
    }

    getX(y) {
        // get the x in a line that includes start and end points
        const k = this.dy / (y - this.#yStart)
        return this.dx / k + this.#xStart
    }
    getY(x) {
        // get the y in a line that includes start and end points
        const k = this.dx / (x - this.#xStart)
        return this.dy / k + this.#yStart
    }

    setEndPointByX(newXEnd) {
        this.#yEnd = this.getY(newXEnd)
        this.#xEnd = newXEnd
        this.#length = Math.sqrt(this.dx ** 2 + this.dy ** 2)
        return this
    }
    setEndPointByY(newYEnd) {
        this.#xEnd = this.getX(newYEnd)
        this.#yEnd = newYEnd
        this.#length = Math.sqrt(this.dx ** 2 + this.dy ** 2)
        return this
    }

    moveTo(x, y) {
        // replace vector by start point
        const dx = this.dx
        const dy = this.dy
        this.#xStart = x
        this.#xEnd = this.#xStart + dx
        this.#yStart = y
        this.#yEnd = this.#yStart + dy
        return this
    }

    reflectByX() {
        // reflect vector by X
        this.#xEnd = this.#xEnd - 2 * this.dx
        return this
    }

    copy() {
        return new Vector(this.#xStart, this.#yStart, this.#xEnd, this.#yEnd)
    }
}

function getRandomInt(min = 0, max = 10) {
    if (max <= min) return min
    return Math.floor(Math.random() * (max - min + 1)) + min
}

onmessage = function (event) {
    const { command, attachment } = event.data
    let workerResult = ''
    if (command === 'start_new_game') {
        new Game()
        workerResult = 'waiting_for_click'
    } else if (command === 'click') {
        Game.game.clickXY = attachment
        workerResult = Game.game.loop.next().value
    }

    const renderDataList = RenderObjects.getRenderData()
    this.postMessage({ workerResult, renderDataList })
}
