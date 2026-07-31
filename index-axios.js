import * as Carousel from "./Carousel.js";
import axios from "axios";

// The breed selection input element.
const breedSelect = document.getElementById("breedSelect");
// The information section div element.
const infoDump = document.getElementById("infoDump");
// The progress bar div element.
const progressBar = document.getElementById("progressBar");
// The get favourites button element.
const getFavouritesBtn = document.getElementById("getFavouritesBtn");

// loading the api key from the local .env file
const API_KEY = process.env.CAT_API_KEY || "";
let breedList = [];

// setting defaults so they do not have to be repeated in every request
axios.defaults.baseURL = "https://api.thecatapi.com/v1";

if (API_KEY) {
  axios.defaults.headers.common["x-api-key"] = API_KEY;
}

axios.interceptors.request.use(function (config) {
  console.log("request started");

  config.requestStart = Date.now();
  progressBar.style.width = "0%";
  document.body.style.cursor = "progress";

  return config;
});

axios.interceptors.response.use(
  function (response) {
    const requestTime = Date.now() - response.config.requestStart;
    console.log(`request finished in ${requestTime} milliseconds`);

    progressBar.style.width = "100%";
    document.body.style.cursor = "default";

    return response;
  },
  function (error) {
    if (error.config && error.config.requestStart) {
      const requestTime = Date.now() - error.config.requestStart;
      console.log(`request failed after ${requestTime} milliseconds`);
    } else {
      console.log("request failed");
    }

    progressBar.style.width = "0%";
    document.body.style.cursor = "default";

    return Promise.reject(error);
  }
);

function updateProgress(progressEvent) {
  console.log("download progress:", progressEvent);

  let percent = 0;

  if (progressEvent.total) {
    percent = Math.round(
      (progressEvent.loaded / progressEvent.total) * 100
    );
  } else if (typeof progressEvent.progress === "number") {
    percent = Math.round(progressEvent.progress * 100);
  }

  if (!Number.isFinite(percent)) {
    percent = 0;
  }

  progressBar.style.width = `${percent}%`;
}

async function initialLoad() {
  try {
    const response = await axios.get("/breeds");
    breedList = response.data;

    breedSelect.innerHTML = "";

    for (let i = 0; i < breedList.length; i++) {
      const option = document.createElement("option");
      option.value = breedList[i].id;
      option.textContent = breedList[i].name;
      breedSelect.appendChild(option);
    }

    await loadBreedImages();
  } catch (error) {
    console.error("there was an issue loading the cat breeds...", error);
  }
}

function buildCarousel(images) {
  Carousel.clear();
  let validImageCount = 0;

  for (let i = 0; i < images.length; i++) {
    if (images[i] && images[i].url && images[i].id) {
      const carouselItem = Carousel.createCarouselItem(
        images[i].url,
        "A cat from The Cat API",
        images[i].id,
        favourite
      );

      Carousel.appendCarousel(carouselItem);
      validImageCount++;
    }
  }

  if (validImageCount > 0) {
    Carousel.start();
  }

  return validImageCount;
}

function getSelectedBreed(images) {
  if (images.length > 0 && images[0].breeds && images[0].breeds.length > 0) {
    return images[0].breeds[0];
  }

  for (let i = 0; i < breedList.length; i++) {
    if (breedList[i].id === breedSelect.value) {
      return breedList[i];
    }
  }

  return null;
}

function addBreedDetail(label, value) {
  const paragraph = document.createElement("p");
  paragraph.textContent = `${label}: ${value || "Not available"}`;
  infoDump.appendChild(paragraph);
}

function displayBreedInfo(breed, imageCount) {
  infoDump.innerHTML = "";

  if (breed) {
    const heading = document.createElement("h3");
    heading.textContent = breed.name || "Unknown breed";
    infoDump.appendChild(heading);

    let weight = "Not available";
    if (breed.weight && breed.weight.imperial) {
      weight = `${breed.weight.imperial} lbs`;
    }

    addBreedDetail("Origin", breed.origin);
    addBreedDetail("Temperament", breed.temperament);
    addBreedDetail("Description", breed.description);
    addBreedDetail("Life span", breed.life_span);
    addBreedDetail("Weight", weight);
    addBreedDetail("Adaptability", breed.adaptability);
    addBreedDetail("Intelligence", breed.intelligence);
  } else {
    const noInfoMessage = document.createElement("p");
    noInfoMessage.textContent = "Breed information is not available.";
    infoDump.appendChild(noInfoMessage);
  }

  if (imageCount === 0) {
    const noImageMessage = document.createElement("p");
    noImageMessage.textContent = "No images are available for this breed.";
    infoDump.appendChild(noImageMessage);
  }
}

async function loadBreedImages() {
  try {
    const breedId = breedSelect.value;
    const response = await axios.get("/images/search", {
      params: {
        limit: 10,
        breed_ids: breedId
      },
      onDownloadProgress: updateProgress
    });

    const images = response.data;

    if (!Array.isArray(images)) {
      throw new Error("Cat API did not return an array of images");
    }

    const imageCount = buildCarousel(images);
    const selectedBreed = getSelectedBreed(images);
    displayBreedInfo(selectedBreed, imageCount);
  } catch (error) {
    console.error("there was an issue loading the cat images...", error);
    Carousel.clear();
    displayBreedInfo(null, 0);
  }
}

breedSelect.addEventListener("change", loadBreedImages);

export async function favourite(imgId) {
  try {
    const favouritesResponse = await axios.get("/favourites");
    const favourites = favouritesResponse.data;

    if (!Array.isArray(favourites)) {
      throw new Error("Cat API did not return an array of favourites");
    }

    let existingFavourite = null;

    // checking if this image is already in the favourites
    for (let i = 0; i < favourites.length; i++) {
      if (favourites[i].image_id === imgId) {
        existingFavourite = favourites[i];
        break;
      }

      if (favourites[i].image && favourites[i].image.id === imgId) {
        existingFavourite = favourites[i];
        break;
      }
    }

    if (existingFavourite) {
      await axios.delete(`/favourites/${existingFavourite.id}`);
      console.log("favourite removed");
    } else {
      await axios.post("/favourites", {
        image_id: imgId
      });
      console.log("favourite added");
    }
  } catch (error) {
    console.error("there was an issue updating the favourite...", error);
  }
}

initialLoad();
