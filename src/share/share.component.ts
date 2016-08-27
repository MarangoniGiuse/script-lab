import {Component, OnInit, OnDestroy, ViewChild, ElementRef, HostListener} from '@angular/core';
import {Router, ActivatedRoute} from '@angular/router';
import {BaseComponent} from '../shared/components/base.component';
import {Utilities, UxUtil} from '../shared/helpers';
import {Snippet, SnippetManager} from '../shared/services';

declare var GitHub;

@Component({
    selector: 'share',
    templateUrl: 'share.component.html',
    styleUrls: ['share.component.scss'],
})
export class ShareComponent extends BaseComponent implements OnInit, OnDestroy {
    private _monacoEditor: monaco.editor.IStandaloneCodeEditor;
    @ViewChild('editor') private _editor: ElementRef;

    loaded: boolean;
    gistId: string;
    embedUrl: string;
    statusDescription = "Preparing the snippet for sharing...";

    _snippet: Snippet;
    _snippetExportString: string;

    constructor(
        _snippetManager: SnippetManager,
        _router: Router,
        private _route: ActivatedRoute

    ) {
        super(_router, _snippetManager);
        this._snippet = new Snippet({}, this._snippetManager);
    }

    ngOnInit() {
        if (!this._ensureContext()) {
            return;
        }
                            
        var subscription = this._route.params.subscribe(params => {
            this._snippetManager.find(params['id'])
                .then(snippet => {
                    this._snippet = snippet;
                    this._snippetExportString = JSON.stringify(snippet.exportToJson(true /*forPlayground*/));
                    return this._initializeMonacoEditor()
                })
                .catch(UxUtil.catchError("Could not load snippet", "An error occurred while fetching the snippet."));
        });

        this.markDispose(subscription);
    }

    private _initializeMonacoEditor(): Promise<any> {
        return new Promise((resolve) => {
            console.log("Beginning to initialize Monaco editor");

            (<any>window).require(['vs/editor/editor.main'], () => {
                this._monacoEditor = monaco.editor.create(this._editor.nativeElement, {
                    value: this._snippetExportString,
                    language: 'text',
                    lineNumbers: true,
                    roundedSelection: false,
                    scrollBeyondLastLine: false,
                    wrappingColumn: 0,
                    readOnly: true,
                    wrappingIndent: "indent",
                    theme: "vs-dark",
                    scrollbar: {
                        vertical: 'visible',
                        verticalHasArrows: true,
                        arrowSize: 15
                    }
                });

                this.loaded = true;
                setTimeout(() => this._monacoEditor.layout(), 20);

                console.log("Monaco editor initialized.");               
            });
        });
    }

    postToGist() {
        this.statusDescription = "Posting the snippet to a new GitHub Gist...";
        this.loaded = false;

        const gh = new GitHub(); // Note: unauthenticated client, i.e., for creating anonymous gist
        let gist = gh.getGist();
        gist
            .create({
                public: true,
                description: '"' + this._snippet.meta.name + '" snippet - ' + Utilities.fullPlaygroundDescription,
                files: {
                    "playground-metadata.json": {
                        "content": this._snippetExportString
                    }
                }
            })
            .then(({data}) => {
                let gistJson = data;
                gist.read((err, gist, xhr) => {
                    this.loaded = true;

                    if (err) {                        
                        UxUtil.showErrorNotification("Gist-creation error",
                            "Sorry, something went wrong when creating the GitHub Gist.", err);
                        return;
                    }

                    this.gistId = gist.id;

                    var playgroundBasePath = window.location.protocol + "//" + window.location.hostname + 
                        (window.location.port ? (":" + window.location.port) : "") + window.location.pathname;
                    this.embedUrl = playgroundBasePath + '#/embed/gist_' + this.gistId;

                    $(window).scrollTop(0); 
                })
            })
            .catch((e) => {
                this.loaded = true;
                UxUtil.showErrorNotification("Gist-creation error",
                    "Sorry, something went wrong when creating the GitHub Gist.", e);
            });
    }

    back() {
        this._router.navigate(['edit', this._snippet.meta.id]);
    }

    @HostListener('window:resize', ['$event'])
    resize() {
        if (this._monacoEditor) {
            this._monacoEditor.layout();
            this._monacoEditor.setScrollTop(0);
            this._monacoEditor.setScrollLeft(0);
        }
    }
}