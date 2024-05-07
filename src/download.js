import fetch from 'node-fetch';
import https from 'https';
import http from 'http';
import fs from 'fs';
import { SPARQLQueryDispatcher } from './SPARQLQueryDispatcher.js';

let client = http;
let topicsJson = JSON.parse(fs.readFileSync('./data/topics.json', 'utf8'));


function downloadImage(url, filepath) {
    return new Promise((resolve, reject) => {
        if (url.toString().indexOf("https") === 0) {
            client = https;
        }
        client.get(url, (res) => {
            if (res.statusCode === 200) {
                res.pipe(fs.createWriteStream(filepath))
                    .on('error', reject)
                    .once('close', () => resolve(filepath));
            } else if (res.statusCode === 301 || res.statusCode === 302) {
                //Recursively follow redirects, only a 200 status code will resolve.
                downloadImage(res.headers.location, filepath)
                    .then(resolve)
                    .catch(reject);
            }
            else {
                // Consume response data to free up memory
                res.resume();
                reject(new Error(`Request Failed With a Status Code: ${res.statusCode}`));

            }
        });
    });
}

async function getImageList(topicObj) {

    console.log("Getting images for " + topicObj.name);

    let list
    const endpointUrl = topicsJson.SPARQL.url;
    const sparqlQuery = topicObj.querry;

    console.log("Querying " + endpointUrl + " with " + sparqlQuery)

    const queryDispatcher = new SPARQLQueryDispatcher(endpointUrl);
    await queryDispatcher.query(sparqlQuery)
        .then(response => {
            list = response.results.bindings;



            for (let i = 0; i < list.length; i++) {


                while (Object.values(list[i]).length < 2) {

                    console.log("Error " + [i] + ": No image found for " + list[i].actorLabel.value + ", trying " + list[i + 1].actorLabel.value);
                    //list[i] = { actorLabel: { value: list[i].actorLabel.value }, image: { value: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTNUsx1LY3dPUcMt02PYqC_VDJuHoxuRJYe7-CguhdPmA&s" } };
                    list.splice(i, 1);

                }



            }

            //console.log(list);
            list.forEach(element => {
                //console.log(element.image.value)
                let stringToSplit = element.image.value;
                let filepath = "./images/" + stringToSplit.split('/')[5]
                //add filepath to element
                element.filepath = filepath;
            });
            //console.log(list.length)



        })
        .catch(
            console.error
        );
    return list;
}

async function downloadImages(imagesList) {
    imagesList.forEach(async element => {
        if (!checkForImage(element.filepath)) {
            await downloadImage(element.image.value, element.filepath)
                .then(console.log)
                .catch(console.error);
        }
        else {
            console.log("Image already exists: " + element.filepath);
        }


    });
}

function checkForImage(imagePath) {
    if (fs.existsSync(imagePath)) { return true; }
    return false;
}


getImageList(topicsJson.topics[0]).then((list) => {
    downloadImages(list);

}).catch(console.error);



