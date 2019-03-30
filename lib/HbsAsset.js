const frontMatter = require('front-matter');
const globby = require('globby');
const handlebars = require('handlebars');
const handlebarsWax = require('handlebars-wax');
const handlebarsLayouts = require('handlebars-layouts');
const handlebarsHelpers = require('handlebars-helpers')();
const HTMLAsset = require('parcel-bundler/src/assets/HTMLAsset');
const { loadUserConfig, parseSimpleLayout } = require('./utils');

const userConfig = loadUserConfig();
const config = Object.assign({}, {
  data: 'src/markup/data',
  decorators: 'src/markup/decorators',
  helpers: 'src/markup/helpers',
  layouts: 'src/markup/layouts',
  partials: 'src/markup/partials',
}, userConfig);

const globs = {
  helpers: `${config.helpers}/**/*.js`,
  data: `${config.data}/**/*.{json,js}`,
  decorators: `${config.decorators}/**/*.js`,
  layouts: `${config.layouts}/**/*.{hbs,handlebars,js}`,
  partials: `${config.partials}/**/*.{hbs,handlebars,js}`
}

const wax = () => handlebarsWax(handlebars)
  .helpers(handlebarsLayouts)
  .helpers(handlebarsHelpers)
  .helpers(globs.helpers)
  .data(globs.data)
  .decorators(globs.decorators)
  .partials(globs.layouts)
  .partials(globs.partials);

class HbsAsset extends HTMLAsset {
  constructor(name, pkg, options) {
    super(name, pkg, options);
    // re-initialize wax object in constructor to properly update template upon 
    // helpers/data/decorators/partials change (may affect performance)
    this.wax = wax();
  }

  parse(code) {
    // process any frontmatter yaml in the template file
    const frontmatter = frontMatter(code);

    // process simple layout mapping that does not use handlebars-layouts. i.e {{!< base}}
    const content = parseSimpleLayout(frontmatter.body, config);

    // combine frontmatter data with NODE_ENV variable for use in the template
    const data = Object.assign({}, frontmatter.attributes, { NODE_ENV: process.env.NODE_ENV });

    // compile template into html markup and assign it to this.contents. super.generate() will use this variable.
    this.contents = this.wax.compile(content)(data);

    // Return the compiled HTML
    return super.parse(this.contents);
  }

  async collectDependencies() {
    await super.collectDependencies();
    // register data files, decorators, partials etc. as dependencies
    const deps = await globby(Object.values(globs));
    deps.forEach(depPath => this.addDependency(depPath, { includedInParent: true }));
  }
}

module.exports = HbsAsset;
