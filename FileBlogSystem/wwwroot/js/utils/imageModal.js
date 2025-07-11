let currentImages = [];
let currentIndex = 0;
let isZoomed = false;

export function initializeImageModal() {
  if (document.getElementById("imageModal")) return; // Prevent duplicates

  const imageModal = document.createElement("div");
  imageModal.id = "imageModal";
  imageModal.classList.add("modal", "hidden");
  imageModal.innerHTML = `
    <div class="modal-content" id="modalContent">
      <span class="close" id="closeImageModal">&times;</span>
      <button class="nav-btn" id="prevImageBtn">&lt;</button>
      <img id="modalImage" src="" alt="Post Image Preview" />
      <button class="nav-btn" id="nextImageBtn">&gt;</button>
    </div>
  `;
  document.body.appendChild(imageModal);

  const modal = document.getElementById("imageModal");
  const modalImage = document.getElementById("modalImage");
  const closeImageModal = document.getElementById("closeImageModal");
  const prevImageBtn = document.getElementById("prevImageBtn");
  const nextImageBtn = document.getElementById("nextImageBtn");

  // Click outside to close
  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      closeModal();
    }
  });

  // Close button
  closeImageModal.addEventListener("click", () => {
    closeModal();
  });

  // Zoom
  modalImage.addEventListener("click", () => {
    isZoomed = !isZoomed;
    if (isZoomed) {
      modalImage.style.maxHeight = "none";
      modalImage.style.cursor = "zoom-out";
    } else {
      resetZoom();
    }
  });

  // Previous
  prevImageBtn.addEventListener("click", () => {
    currentIndex =
      (currentIndex - 1 + currentImages.length) % currentImages.length;
    modalImage.src = currentImages[currentIndex];
    isZoomed = false;
    resetZoom();
  });

  // Next
  nextImageBtn.addEventListener("click", () => {
    currentIndex = (currentIndex + 1) % currentImages.length;
    modalImage.src = currentImages[currentIndex];
    isZoomed = false;
    resetZoom();
  });
}

export function openImageModal(images, clickedIndex) {
  if (!images?.length) return;

  currentImages = images;
  currentIndex = clickedIndex;
  isZoomed = false;

  const modal = document.getElementById("imageModal");
  const modalImage = document.getElementById("modalImage");
  const modalContent = document.getElementById("modalContent");
  const prevImageBtn = document.getElementById("prevImageBtn");
  const nextImageBtn = document.getElementById("nextImageBtn");

  modalImage.src = currentImages[currentIndex];
  resetZoom();
  modal.classList.remove("hidden");

  // Hide navigation if only one image
  if (currentImages.length <= 1) {
    modalContent.setAttribute("data-single-image", "true");
    prevImageBtn.style.display = "none";
    nextImageBtn.style.display = "none";
  } else {
    modalContent.setAttribute("data-single-image", "false");
    prevImageBtn.style.display = "block";
    nextImageBtn.style.display = "block";
  }
}

function resetZoom() {
  const modalImage = document.getElementById("modalImage");
  modalImage.style.maxHeight = "80vh";
  modalImage.style.cursor = "zoom-in";
}

function closeModal() {
  const modal = document.getElementById("imageModal");
  modal.classList.add("hidden");
  isZoomed = false;
  resetZoom();
}
