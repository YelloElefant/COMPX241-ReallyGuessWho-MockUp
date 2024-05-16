import { Client } from 'boardgame.io/client';
import { GuessWho } from './Game';
import { SPARQLQueryDispatcher } from './SPARQLQueryDispatcher';
import request from 'request';
import { SocketIO } from 'boardgame.io/multiplayer'
import { LobbyClient } from 'boardgame.io/client';


class GuessWhoClient {

    constructor(rootElement, imagesList, { playerID } = {}) {
        this.client = Client({
            numPlayers: 2,
            matchID: 'guesswho',
            game: GuessWho,
            multiplayer: SocketIO({ server: '192.168.1.29:8000' }),
            playerID,
        });

        console.log("YOUR PLAYER ID IS", playerID);
        console.log("YOUR MATCH ID IS", this.client.matchID);

        this.client.start();
        this.rootElement = rootElement.appElement;


        this.rootElement.innerHTML += "<h1>Guess Who</h1>";
        this.rootElement.innerHTML += "<h2 id='turn'>Player Turn: </h2>";

        this.createBoard(0, imagesList);
        this.rootElement.innerHTML += "<br>"
        this.createBoard(1, imagesList);

        this.attachListeners();
        this.initializeChat();
        this.client.subscribe(state => {
            this.update(state)
            this.displayChatMessages();
        });


    }

    sendChatMessage(message) {
        this.client.sendChatMessage(message);
    }


    // Method to display chat messages
    displayChatMessages() {
        const chatContainer = document.getElementById('chat-messages');
        chatContainer.innerHTML = ''; // Clear previous messages

        this.client.chatMessages.forEach(message => {
            const messageElement = document.createElement('div');
            console.log(message)
            messageElement.textContent = `${message.sender}: ${message.payload}`;
            chatContainer.appendChild(messageElement);
        });
    }

    // Method to initialize chat UI and event listeners
    initializeChat() {
        const messageInput = document.getElementById('message-input');
        const sendButton = document.getElementById('send-button');

        sendButton.addEventListener('click', () => {
            const message = messageInput.value;
            this.sendChatMessage(message);
            messageInput.value = ''; // Clear input field after sending
        });



    }


    createBoard(tableNum, images) {
        let board = this.rootElement.querySelector('#board' + tableNum);
        const rows = [];



        for (let i = 0; i < 5; i++) {
            const cells = [];
            for (let j = 0; j < 6; j++) {
                const id = 6 * i + j;

                let temp = `<td class="cellWrapper" ><div class="cell"  data-id="${id}" data-tablenum="${tableNum}" style="background-image: url(${images[id].image.value})"></div></td>`
                cells.push(temp);


            }
            rows.push(`<tr>${cells.join('')}</tr>`);
        }
        board.innerHTML += `
      <table>${rows.join('')}</table>
      <p class="winner"></p>`;

    }



    attachListeners() {
        // This event handler will read the cell id from a cell’s
        // `data-id` attribute and make the `clickCell` move.
        const handleCellClick = event => {
            const id = parseInt(event.target.dataset.id);
            const tableNum = parseInt(event.target.dataset.tablenum);
            const playerTurn = this.client.getState().ctx.currentPlayer;
            console.log(playerTurn != tableNum)
            console.log(event.target.innerHTML == playerTurn);
            let passscore = 0;

            if (playerTurn != tableNum) {
                alert("Wrong Board!");
                return
            }
            else { passscore++; }
            if (event.target.innerHTML == playerTurn) {
                alert("Already clicked!");
                return
            }
            else { passscore++; }
            console.log("your passscore is", passscore)
            if (passscore == 2) { this.client.moves.clickCell(id, tableNum); }

        };
        // Attach the event listener to each of the board cells.
        const cells = this.rootElement.querySelectorAll('.cell');
        cells.forEach(cell => {
            cell.onclick = handleCellClick;
        });
    }




    update(state) {
        if (state === null) return;
        // Get all the board cells.
        let cells = this.rootElement.querySelectorAll("[data-tablenum='0']");
        // Update cells to display the values in game state.
        cells.forEach(cell => {
            const cellId = parseInt(cell.dataset.id);
            const cellValue = state.G.cells0[cellId];
            cell.textContent = cellValue !== null ? cellValue : '';
        });

        cells = this.rootElement.querySelectorAll("[data-tablenum='1']");
        cells.forEach(cell => {
            const cellId = parseInt(cell.dataset.id);
            const cellValue = state.G.cells1[cellId];
            cell.textContent = cellValue !== null ? cellValue : '';
        });

        let currentPlayer = state.ctx.currentPlayer;
        currentPlayer === "0" ? this.rootElement.querySelector("#turn").textContent = "Player Turn: 0" : this.rootElement.querySelector("#turn").textContent = "Player Turn: 1";




        // Get the gameover message element.
        const messageEl = this.rootElement.querySelector('.winner');
        // Update the element to show a winner if any.
        if (state.ctx.gameover) {
            messageEl.textContent =
                state.ctx.gameover.winner !== undefined
                    ? 'Winner: ' + state.ctx.gameover.winner
                    : 'Draw!';
        } else {
            messageEl.textContent = '';
        }
    }

}





async function getImages() {
    let imagesList;



    console.log("runnig")

    const endpointUrl = 'https://query.wikidata.org/sparql';
    const sparqlQuery = `SELECT ?actor ?actorLabel ?image ?height ?date_of_birth WHERE {
            SERVICE wikibase:label { bd:serviceParam wikibase:language "[AUTO_LANGUAGE],en". }
            ?actor wdt:P106 wd:Q33999.
            OPTIONAL { ?actor wdt:P18 ?image. }
            OPTIONAL { ?actor wdt:P2048 ?height. }
            OPTIONAL { ?actor wdt:P569 ?date_of_birth. }
        }
        LIMIT 60`;

    const queryDispatcher = new SPARQLQueryDispatcher(endpointUrl);


    // await queryDispatcher.query(sparqlQuery).then(response => {
    //     imagesList = response.results.bindings;

    //     console.log(imagesList);


    //     for (let i = 0; i < imagesList.length; i++) {


    //         while (!("image" in imagesList[i])) {

    //             console.log(i);
    //             console.log("Error " + [i] + ": No image found for " + imagesList[i].actorLabel.value);
    //             //imagesList[i] = { actorLabel: { value: imagesList[i].actorLabel.value }, image: { value: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTNUsx1LY3dPUcMt02PYqC_VDJuHoxuRJYe7-CguhdPmA&s" } };
    //             imagesList.splice(i, 1);

    //         }



    //     }

    //     console.log(imagesList);
    //     console.log("run")



    // });
    try {
        const response = await queryDispatcher.query(sparqlQuery);
        if (response && response.results && response.results.bindings) {
            let imagesList = response.results.bindings.filter(item => "image" in item);
            console.log(imagesList);
            return imagesList;
        } else {
            console.error("Invalid response format:", response);
            return [];
        }
    } catch (error) {
        console.error("Error fetching images:", error);
        return [];
    }



    //console.log(imagesList);
    return imagesList;
}



async function startGame() {
    const playerCredentials = sessionStorage.getItem('playerCredentials');
    const playerName = sessionStorage.getItem('playerName');
    console.log("playerCredentials: ", playerCredentials);
    console.log("playerName: ", playerName);

    const lobbyClient = new LobbyClient({ server: 'http://localhost:8081' });

    const games = await lobbyClient.listGames()
        .then(console.log) // => ['chess', 'tic-tac-toe']
        .catch(console.error);

    const imageList = await getImages()
    const appElement = document.getElementById('app');




    new GuessWhoClient({ appElement }, imageList, { playerID: playerName });


}





startGame();


