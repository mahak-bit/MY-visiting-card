/* ============================================================================
   MAHAK JAIN — PERSONAL BRAND :: SINGLE SOURCE OF TRUTH
   ----------------------------------------------------------------------------
   This is the ONLY file you need to edit to update links, projects, or the
   QR destination. It is read by:

     index.html        the landing page
     card/card.html    both visiting-card faces, and the QR
     tools/verify.html the QR encoder checks

   TWO RULES THIS FILE ENFORCES
     1. An empty url ('') means UNCONFIGURED. The landing page renders it as a
        visibly inert row — never a link to a dead or invented destination.
     2. siteUrl must be the real PUBLIC url of the deployed landing page. While
        it is empty, the card back prints a clearly-marked "QR PENDING" tile.
        No fake or decorative QR is ever drawn.
   ========================================================================== */

var PROFILE = {

  /* --- Identity: exact wording, do not paraphrase ----------------------- */
  name:    'Mahak Jain',
  title:   'AI/ML Engineer & Software Developer',
  focus:   'AI/ML · PYTHON · WEB APPLICATIONS',
  tagline: 'Building with AI, shipping with code.',

  /* --- The landing page introduction ------------------------------------ */
  intro:
    'I build intelligent software — bringing machine learning, generative AI ' +
    'and practical web development into the same workflow. My focus is turning ' +
    'models and ideas into applications people can actually use: considered ' +
    'Python at the core, a clean interface on top.',

  /* ======================================================================
     THE QR DESTINATION  <-  the one value that makes the card printable
     ----------------------------------------------------------------------
     Paste the real public https:// url of your deployed landing page here.
     After a Vercel deploy it will look like:
         siteUrl: 'https://visiting-abc123.vercel.app',

     Leave it as '' until that deploy exists.

     Rejected automatically, by design: empty strings, [BRACKETED] text,
     localhost, 127.x, 10.x, 192.168.x, 172.16-31.x, *.local and anything
     that is not an absolute http(s) URL. A printed card cannot reach any
     of them, so the card falls back to the pending tile instead.
     ====================================================================== */
  siteUrl: 'https://mahak-bit.github.io/MY-visiting-card/',

  /* --- The five link buttons, in display order --------------------------
     key   stable id, do not rename
     label exact button text
     url   '' means unconfigured; for kind:'email' a bare address is fine
     meta  the small line shown under the label once configured
     hint  what to do, shown while it is unconfigured
     -------------------------------------------------------------------- */
  links: [
    {
      key:   'portfolio',
      label: 'Explore My Portfolio',
      url:   'https://mahak-jain-portfolio.vercel.app/',
      kind:  'url',
      meta:  'Selected work & case studies',
      hint:  'Add your portfolio URL in config/profile.js'
    },
    {
      key:   'linkedin',
      label: 'Connect on LinkedIn',
      url:   'https://www.linkedin.com/in/mahak-jain-7665432a3',
      kind:  'url',
      meta:  'Professional network',
      hint:  'Add your LinkedIn URL in config/profile.js'
    },
    {
      key:   'github',
      label: 'Explore My GitHub',
      url:   'https://github.com/mahak-bit',     /* the one URL you supplied */
      kind:  'url',
      meta:  'Code, experiments & repositories',
      hint:  ''
    },
    {
      key:   'instagram',
      label: 'Follow on Instagram',
      url:   'https://www.instagram.com/tech._bloom/',
      kind:  'url',
      meta:  'Behind the build',
      hint:  'Add your Instagram URL in config/profile.js'
    },
    {
      key:   'email',
      label: 'Email Me',
      url:   'mahakjain2323@gmail.com',
      kind:  'email',
      meta:  'Direct enquiries',
      hint:  'Add your email address in config/profile.js'
    }
  ],

  /* --- The GitHub reference printed on the card back -------------------- */
  githubHandle: 'github.com/mahak-bit',

  /* --- Selected projects -------------------------------------------------
     EDITABLE PLACEHOLDERS. Nothing here is a claim about completed work.
     Replace the bracketed text with real projects; delete an entry to remove
     its card; set url to '' to omit the link.

     Keep it factual: what it does, what you built. No metrics you cannot
     evidence, no outcomes you cannot point at.
     -------------------------------------------------------------------- */
  projects: [
    {
      title:    'Zazzlers',
      summary:  'A streetwear storefront built around a seasonal campaign — ' +
                'collections and lookbook, product browsing, wishlist and cart, ' +
                'with the campaign photography carrying the full-bleed hero.',
      stack:    ['Next.js', 'React', 'Vercel'],
      url:      'https://zazzlers.vercel.app/',
      image:    'assets/projects/zazzlers.webp',
      imageAlt: 'Zazzlers homepage: a full-bleed streetwear campaign photograph ' +
                'behind the headline "Wear The Attitude".',
      year:     ''
    },
    {
      title:    'Pawan Industries',
      summary:  'A site for a rice milling business, told as full-screen chapters — ' +
                'craft, products, sustainability, people and gallery — with film and ' +
                'photography doing the explaining instead of long copy.',
      stack:    ['Next.js', 'React', 'Vercel'],
      url:      'https://pawan-industries-livid.vercel.app/',
      image:    'assets/projects/pawan-industries.webp',
      imageAlt: 'Pawan Industries site showing milling machinery behind the ' +
                'headline "Pawan Industries — precision in every grain".',
      year:     ''
    },
    {
      title:    'Twacha Clinic',
      summary:  'A website for a dermatology practice in Kota — treatment information ' +
                'across skin, hair and aesthetic care, with appointment booking and ' +
                'FAQs, in a quiet editorial layout.',
      stack:    ['Next.js', 'React', 'Vercel'],
      url:      'https://twacha-clinic.vercel.app/',
      image:    'assets/projects/twacha-clinic.webp',
      imageAlt: 'Twacha Clinic homepage with the serif headline ' +
                '"Healthy Skin. Expert Care. Confidence That Shows."',
      year:     ''
    }
  ],

  /* --- Page metadata ---------------------------------------------------- */
  meta: {
    pageTitle:   'Mahak Jain — AI/ML Engineer & Software Developer',
    description: 'AI/ML Engineer & Software Developer. AI/ML · Python · Web Applications. Building with AI, shipping with code.'
  },

  /* --- Print settings (sensible defaults; change only with reason) ------ */
  print: {
    /* QR error correction. 'M' recovers 15% of a damaged symbol — the right
       trade-off for a card that lives in wallets. Options: L M Q H.
       Higher levels add modules, which makes each module smaller. */
    qrEcc: 'M',

    /* Printed QR edge length in inches, excluding the quiet zone.
       0.84in is about 21mm, comfortably above the ~20mm practical floor
       for reliable phone scanning. */
    qrSizeIn: 0.84
  }
};

/* Expose for plain <script> use. Works identically over file:// and http://,
   which is why this is not an ES module. */
if (typeof window !== 'undefined') { window.PROFILE = PROFILE; }
if (typeof module !== 'undefined' && module.exports) { module.exports = PROFILE; }
