import * as $ from 'jquery';
import * as moment from 'moment';
import {
  storage,
  environment,
  applyTheme,
  setUpMomentJsDurationDefaults,
  isCustomFunctionScript,
} from '../app/helpers';
import { Strings } from '../app/strings';
import '../assets/styles/extras.scss';
import {
  navigateToRunner,
  navigateToCustomFunctionsDashboard,
} from '../app/helpers/navigation.helper';

(async () => {
  await environment.initialize();
  await applyTheme(environment.current.host);

  const strings = Strings();

  document.title = strings.HtmlPageStrings.PageTitles.run;

  document.getElementById('subtitle').textContent =
    strings.HtmlPageStrings.loadingRunnerDotDotDot;
  document.getElementById('subtitle').style.visibility = 'visible';

  document.getElementById('choose-your-host').textContent =
    strings.HtmlPageStrings.chooseYourHost;
  document.getElementById('choose-your-host').style.visibility = 'visible';

  document.getElementById('last-opened-header-text').textContent =
    strings.HtmlPageStrings.lastOpenedSnippet;
  document.getElementById('last-opened-empty').textContent =
    strings.HtmlPageStrings.noLastOpenedSnippets +
    ' ' +
    strings.HtmlPageStrings.toGetStartedCreateOrImportSnippet;
  document.getElementById('my-saved-snippets').textContent =
    strings.HtmlPageStrings.mySavedSnippets;
  document.getElementById('snippet-list-empty').textContent =
    strings.HtmlPageStrings.noLocalSnippets +
    ' ' +
    strings.HtmlPageStrings.toGetStartedCreateOrImportSnippet;

  new Gallery();
})();

export class Gallery {
  private _$progress = $('#progress');
  private _$subtitle = $('#subtitle');
  private _$gallery = $('#gallery');
  private _$snippetList = $('#snippet-list');
  private _$noSnippets = $('#snippet-list-empty');
  private _$lastOpened = $('#last-opened');
  private _$lastOpenedEmpty = $('#last-opened-empty');

  private _template = `<article class="gallery-list__item gallery-list__item--template ms-font-m">
        <div class="name">{{name}}</div>
        <div class="description">{{description}}</div>
    </article>`;

  constructor() {
    setUpMomentJsDurationDefaults(moment);

    storage.snippets.notify().subscribe(() => this.render());
    storage.settings.notify().subscribe(() => this.renderLastOpened());

    if (window.location.href.indexOf('gallery=true') < 0) {
      if (storage.current.lastOpened) {
        this._postSnippet(storage.current.lastOpened);
        return;
      }
    }

    // Otherwise, proceed to render
    this.hideProgress();
    this.render();
    this.renderLastOpened();
  }

  showProgress(message: string) {
    this._$subtitle.text(message);
    this._$progress.show();
    this._$gallery.hide();
  }

  hideProgress() {
    this._$progress.hide();
    this._$gallery.show();
  }

  render() {
    this._$snippetList.html('');
    storage.snippets.load();
    if (storage.snippets.count) {
      this._$noSnippets.hide();
      storage.snippets
        .values()
        .forEach(snippet => this.insertSnippet(snippet, this._$snippetList));
      this._$snippetList.show();
    } else {
      this._$noSnippets.show();
      this._$snippetList.hide();
    }
  }

  renderLastOpened() {
    this._$lastOpened.html('');
    storage.settings.load();
    if (storage.current.lastOpened) {
      this.insertSnippet(storage.current.lastOpened, this._$lastOpened);
      this._$lastOpened.show();
      this._$lastOpenedEmpty.hide();
    } else {
      this._$lastOpened.hide();
      this._$lastOpenedEmpty.show();
    }
  }

  insertSnippet({ id, name, description, modified_at }: ISnippet, location: JQuery) {
    let $item = $(this._template);
    $item.children('.name').text(name);
    $item.children('.description').text(description);

    $item.click(() => {
      $item.attr('title', '');
      this._navigateById(id);
    });

    $item.on('mouseover', () =>
      $item.attr(
        'title',
        `${Strings().HtmlPageStrings.lastUpdated} ${moment(modified_at).fromNow()}`
      )
    );

    $item.appendTo(location);
  }

  private _navigateById(id: string) {
    // Refresh the snippets and settings, in case there was a code change to one of the snippets.
    storage.settings.load();
    storage.snippets.load();
    let snippet = storage.snippets.get(id);

    /**
     * Check if the clicked snippet is the lastOpened
     */
    if (snippet === null) {
      let lastOpened = storage.current.lastOpened;
      snippet = id === lastOpened.id ? lastOpened : null;
    }

    /**
     * If the snippet was deleted or was corrupt,
     * then just reload to clear cache.
     */
    if (snippet === null) {
      this.render();
    }

    this._postSnippet(snippet);
  }

  private _postSnippet(snippet: ISnippet) {
    const returnUrl = `${location.protocol}//${location.host}${
      location.pathname
    }?gallery=true`;

    if (isCustomFunctionScript(snippet.script.content)) {
      // Navigate to the dashboard page. Since it's on the same domain,
      // navigation should be quick, so don't worry about changing the progress text.
      navigateToCustomFunctionsDashboard(returnUrl);
    } else {
      // The regular runner can take a moment to load, since it requires
      // navigating to a different server.  So, show a progress indicator
      this.showProgress(`${Strings().HtmlPageStrings.running} "${snippet.name}"`);

      navigateToRunner(snippet, returnUrl);
    }
  }
}
