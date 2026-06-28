// Navbar scroll effect
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 40);
});

// Mobile hamburger
const hamburger = document.getElementById('hamburger');
const navLinks = document.getElementById('nav-links');
hamburger.addEventListener('click', () => {
  navLinks.classList.toggle('open');
});
document.addEventListener('click', (e) => {
  if (!navbar.contains(e.target)) navLinks.classList.remove('open');
});

// Phone number mask
const phoneInput = document.getElementById('phone');
phoneInput.addEventListener('input', () => {
  let v = phoneInput.value.replace(/\D/g, '');
  if (v.length <= 10) {
    v = v.replace(/^(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3');
  } else {
    v = v.replace(/^(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3');
  }
  phoneInput.value = v;
});

// Lead form submission
const form = document.getElementById('lead-form');
const formSuccess = document.getElementById('form-success');
form.addEventListener('submit', (e) => {
  e.preventDefault();
  form.style.display = 'none';
  formSuccess.classList.add('visible');
});

// Animate elements on scroll
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.style.opacity = '1';
      entry.target.style.transform = 'translateY(0)';
    }
  });
}, { threshold: 0.1 });

document.querySelectorAll('.process__step, .custom-card, .finance-card').forEach(el => {
  el.style.opacity = '0';
  el.style.transform = 'translateY(20px)';
  el.style.transition = 'opacity .5s ease, transform .5s ease';
  observer.observe(el);
});
