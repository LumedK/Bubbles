export class Settings {
    static rows = 17
    static columns = 17
    static bubbleRadius = 24
    static bubbleSpawnX = 0
    static bubbleSpawnY = 0
    static nextBubbleSpawnX = 0
    static nextBubbleSpawnY = 0

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

export class Message {
    static worker
    static onmessage

    constructor(command, attachment) {
        this.command = command
        this.attachment = attachment
    }

    post() {
        try {
            this.constructor.worker.postMessage(this)
        } catch (error) {
            console.log(`Can't send the message: ${error}`)
        }
    }
}

const game = {
    finished: false,
    initiated: false,
    aimBubble,
    nextBubble,
    lives,

    initiate() {
        this.initiated = true
        this.aimBubble = new Bubble(
            Settings.bubbleSpawnX,
            Settings.bubbleSpawnY
        )
        this.nextBubble = new Bubble(
            Settings.nextBubbleSpawnX,
            Settings.nextBubbleSpawnY
        )
    },

    loop: function* () {
        while (!game.finished) {
            if (!game.initiated) initiate()

            gameAction_addBubblesLines()
        }
    }
}

class Render {
    getRenderData() {}
    draw() {}
}

class RenderObjects {
    static objects = []
    constructor() {
        RenderObjects.objects.push(this)
        this.Render = Render
    }

    static getRenderData() {
        const renderDataList = []
        RenderObjects.objects.forEach((object) => {
            renderDataList.push(object.Render.getRenderData(object))
        })

        return renderDataList
    }
}

class BubbleRender extends Render {
    getRenderData(bubble) {
        return {
            Render: 'BubbleRender',
            x: bubble.x,
            y: bubble.y,
            radius: bubble.r,
            bubbleType: bubble.type
        }
    }

    draw() {
        console.log('drawing the bubble')
    }
}

class Bubble extends RenderObjects {
    static possibleTypes = [
        bubble_0,
        bubble_1,
        bubble_2,
        bubble_3,
        bubble_4,
        bubble_5
    ]
    constructor(x, y) {
        this.x = x
        this.y = y
        this.r = Settings.bubbleRadius
        this.type = getRandomInt(0, Bubble.possibleTypes.length)
    }
}

class StaticBubble extends Bubble {
    static bubbles = []
    static matrix = []

    constructor(row, column, x, y) {
        super(x, y)
        this.row = row
        this.column = column
        this.r = Settings.bubbleRadius
        StaticBubble.bubbles.push(this)
        adjacentBubble = []
    }

    static initiate() {
        const radius = Settings.bubbleRadius
        for (let row = 0; row <= Settings.rows; row++) {
            StaticBubble.matrix[row] = []
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
        for (bubble of StaticBubble.bubbles) {
            function add(adjacentBubbles) {
                if (adjacentBubbles) bubble.adjacentBubble.push(adjacentBubbles)
            }
            add(bubble) // current
            const matrix = StaticBubble.matrix
            add(matrix[bubble.row][bubble.column - 1]) // left cell
            add(matrix[bubble.row][bubble.column + 1]) // right cell
            add(matrix[bubble.row - 1][bubble.column]) // top cell
            add(matrix[bubble.row - 1][bubble.column]) // bottom cell
            const shift = row % 2 === 0 ? -1 : +1
            add(matrix[bubble.row - 1][bubble.column + shift]) // top shift cell
            add(matrix[bubble.row - 1][bubble.column + shift]) // bottom shift cell
        }
    }
}

// Special objects

class Lives {
    constructor() {
        this.maxLives = Settings.maxLives
        this.currentLives = Settings.maxLives
    }
}

// Game actions

function gameAction_addBubblesLines() {
    function getRandomTypeList() {
        const differenceTypes = new Set()
        const list = []
        const length = Bubble.possibleTypes.length
        for (let i = 0; i <= numberOfNewBubbles; i++) {
            let number = getRandomInt(0, length)
            list.push(number)
            differenceTypes.add(number)
        }
        if (game.aimBubble.type) differenceTypes.add(game.aimBubble.type)

        if (differenceTypes.size !== length) return getRandomTypeList()
        return list
    }

    const numberOfAddingLines =
        Settings.addLineRule[Bubble.possibleTypes.length][game.Lives.maxLives]
    let numberOfNewBubbles = 0

    // Shift the bubbles
    for (bubble of StaticBubble.bubbles.slice().reverse()) {
        if (!bubble.type) continue
        if (bubble.row + numberOfAddingLines > Settings.rows) continue
        let offsetBubbles =
            StaticBubble.matrix[bubble.row + numberOfNewLines][bubble.column]
        offsetBubbles.type = bubble.type
        bubble.type = undefined
        numberOfNewBubbles++
    }

    // Get list of random types
    const list = getRandomTypeList()

    // Fill types of bubbles
    list.forEach((type, index) => {
        StaticBubble.bubbles[index].type = type
    })
}

// Common

function getRandomInt(min = 0, max = 10) {
    if (max <= min) return min
    return Math.floor(Math.random() * (max - min + 1)) + min
}

// Run

Message.worker = this
Message.onmessage = function (event) {
    const message = event.data
    if (!message instanceof Message) {
        console.log('Unexpected message for worker')
    }

    switch (message.command) {
        case 'start_new_game':
            game.initiate()
            game.loop().next()
            break
    }
}

/*
class Settings {
    static rows = 17
    static columns = 17
    static ballRadius = 24
    static ballSpawnX = 0
    static ballSpawnY = 0
    static nextBallSpawnX = 0
    static nextBallSpawnY = 0
}

export class Message {
    static worker
    static onmessage

    constructor(command, attachment) {
        this.command = command
        this.attachment = attachment
    }

    post() {
        try {
            this.constructor.worker.postMessage(this)
        } catch (error) {
            console.log(`Can't send the message: ${error}`)
        }
    }
}

const game = {
    currentEvent: undefined,
    aimCell: new Cell({ x: ballSpawnX, y: ballSpawnY, inGrid: false }),
    nextAimCell: new Cell({ x: ballSpawnX, y: ballSpawnY, inGrid: false }),
    initiate() {
        this.objectsToRender = []
        this.getNextBall()
    },

    getNextBall() {
        if (!this.aimCell.ball) {
            this.nextAimCell.ball = Boolean(this.nextAimCell.ball)
                ? this.nextAimCell.ball
                : new Ball()
        }
    },

    
    // loop = function* (){
    //     if (!this.currentEvent) this.initiate() 
        
    //     while (true){
    //         if(this.currentEvent instanceof WaitingRender){

    //         }


    //     }
    // }
    
    
    // loop* () {
    //     if (!this.currentEvent) this.initiate()
    //     this.currentEvent.do()

    //     new Message('render_objects', RenderObject.getRenderData()).post()
    // }
    
}

// Render game objects

class Render {
    getRenderData(){}
    draw(){}
}

class RenderObjects {
    static objects = []
    constructor(){
        RenderObjects.objects.push(this)
        this.Render = Render  
    }
 
    static getRenderData(){
       const renderDataList = [] 
        RenderObjects.objects.forEach(object =>{
            renderDataList.push(object.Render.getRenderData(object))
        })

        return renderDataList
    }
}

class Ball extends RenderObjects {
    static possibleTypes = [ball_0, ball_1, ball_2, ball_3, ball_4, ball_5]

    constructor() {
        super()
        this.x
        this.y
        this.type =
            Ball.possibleTypes[getRandomInt(0, Ball.possibleTypes.length - 1)]

        Render.objects.push(this)    
    }

}

class BallRender extends Render{
    getRenderData(ball){
        return {
            Render: 'BallRender',
            x: ball.x,
            y: ball.y,
            radius: ball.radius,
            ballType: ball.type,
        }
    }
    
    draw(){
        console.log('drawing the ball');
    }
}

// Game objects

class Cell {
    #ball
    static cells = []
    static matrix = []

    constructor({ row, column, x, y, inGrid = true }) {
        this.row = row
        this.column = column
        this.x = x
        this.y = y
        this.#ball = undefined
        if (inGrid) {
            Cell.matrix[row][column] = this
            Cell.cells.push(this)
        }
    }

    get ball() {
        return this.#ball
    }
    set ball(ball) {
        this.#ball = ball
        this.ball.x = this.x
        this.ball.y = this.y
    }

    static createCells() {
        const ballRadius = Settings.ballRadius
        for (let row = 0; row <= Settings.rows; row++) {
            Cell.matrix[row] = []
            for (let column = 0; column < Settings.columns; column++) {
                new Cell({
                    row: row,
                    column: column,
                    x: ballRadius * (2 * column + 1 + (row % 2)),
                    y: ballRadius * (2 * row + 1)
                })
            }
        }
    }
}

// Game events

class GameEvent {
    static nextEvent
    do() {}
}

class AddBallLines extends GameEvent {

    do() {
        const numberOfNewLines = 5
        this.addLines(numberOfNewLines)
    }

    addLines(numberOfNewLines) {
        let numberOfNewRows = -1
        // shift the balls
        for (let cell of Cell.cells.slice().reverse()) {
            if (!cell.ball) continue
            if (cell.row + numberOfNewLines > Settings.rows) continue
            let offsetCell =
                Cell.matrix[cell.row + numberOfNewLines][cell.column]
            offsetCell.ball = cell.ball

            numberOfNewRows =
                numberOfNewRows === -1
                    ? Cell.cells.indexOf(cell) + 1
                    : numberOfNewRows
        }

        const listOfBalls = getListOfBalls(numberOfNewRows)
        for (cell of Cell.cells) {
            if (setOfBalls.length === 0) break
            cell.ball = listOfBalls.shift()
        }
    }

    getListOfBalls(numberOfNewRows) {
        const listOfBalls = []
        const SetOfTypes = new Set()
        for (let i = numberOfNewRows; i < 0; i--) {
            let newBall = new Ball()
            listOfBalls.push(newBall)
            SetOfTypes.add(newBall.type)
        }
        if (SetOfTypes.size !== Ball.possibleTypes.length) {
            getListOfBalls(numberOfNewRows) // listOfBalls must include all possible ball's types
        }
        return listOfBalls
    }
}

// class RenderObject {
//     static objects = []

//     constructor() {
//         game.objectsToRender.push(this)
//         RenderObject.objects.push(this)
//     }

//     static getRenderData(){
//         RenderObject.objects.forEach(object => {
//             Object.prototype.constructor.getRenderData(object)
//         });
//     }
// }

// class BallRender extends Ball{
//     static initiate = (()=>{
//         Ball.getRenderData = BallRender.getRenderData

//     })()
// }

// Common

function getRandomInt(min = 0, max = 10) {
    if (max <= min) return min
    return Math.floor(Math.random() * (max - min + 1)) + min
}

// Run

Message.worker = this
Message.onmessage = function (event) {
    const message = event.data
    if (!message instanceof Message) {
        console.log('Unexpected message for worker')
    }

    switch (message.command) {
        case 'start_new_game':
            game.initiate()
            break
    }

    game.currentEvent = new AddBallLines()
}
*/
