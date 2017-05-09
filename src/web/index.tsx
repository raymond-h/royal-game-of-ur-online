import deepstream = require('deepstream.io-client-js');
import React = require('react');
import ReactDOM = require('react-dom');
import Rx = require('rxjs/Rx');
import R = require('ramda');
import whenDomReady = require('when-dom-ready');

import { Game } from './game';

function fromDsRecord(
	client: deepstreamIO.Client,
	recordName: string,
	triggerImmediately: boolean): Rx.Observable<any> {

	return Rx.Observable.fromEventPattern(
		handler => {
			const record = client.record.getRecord(recordName);
			record.subscribe((handler as (data: any) => void), triggerImmediately);
			return record;
		},
		(handler, record: deepstreamIO.Record) => {
			record.unsubscribe((handler as (data: any) => void));
			record.discard();
		}
	);
}

interface AppState {
	loginState: string;
	clientData: any | null;
	game: any | null;
	gameId: string | null;
}

class App extends React.Component<{}, AppState> {
	subscription: Rx.Subscription;
	gameStateObs: Rx.Observable<AppState>;
	client: deepstreamIO.Client;

	constructor(props) {
		super(props);

		this.state = { loginState: 'logging-in', clientData: null, game: null, gameId: null };

		this.client =
			deepstream(process.env.DEEPSTREAM_URL)
			.login((success, data) => {
				if(success) {
					this.setState({ loginState: 'logged-in', clientData: data });
				}
				else {
					this.setState({ loginState: 'error' });
				}
			});

		this.gameStateObs = Rx.Observable.fromEvent(window, 'hashchange')
			.map(() => location.hash)
			.startWith(location.hash)
			.map(hash => /#?(.+)/.exec(hash))
			.map(hash => (hash != null) ? hash[1] : '')
			.distinctUntilChanged()
			.switchMap(hash => {
				if(hash === '') {
					return Rx.Observable.of({ game: null, gameId: null } as any);
				}
				else {
					return fromDsRecord(this.client, `game/${hash}`, true)
						.map(game => ({ game, gameId: hash }));
				}
			});
	}

	componentDidMount() {
		this.subscription = this.gameStateObs.subscribe(data => this.setState(data));
	}

	componentWillUnmount() {
		this.subscription.unsubscribe();
	}

	onNewGame() {
		this.client.rpc.make('newGame', undefined, (err, result) => {
			if(err) {
				return alert(`Error occured when creating new game: ${err}`);
			}

			location.hash = `#${result.gameId}`;
		});
	}

	onAction(action) {
		this.client.rpc.make('performAction', { gameId: this.state.gameId, action }, (err, result) => {
			if(err) {
				return alert(`Error occured when performing action: ${err}`);
			}

			console.log('action went ok brah');
		});
	}

	render() {
		if(this.state.loginState !== 'logged-in') {
			return <p>Wait a sec...</p>;
		}

		if(this.state.clientData.type !== 'user') {
			return <div>
				<a href='/login'>Log in (or sign up)</a>
				<p>
					Hello guest!
				</p>
				<Game state={this.state.game} onAction={this.onAction.bind(this)} />
			</div>;
		}

		const displayName = this.state.clientData.auth0.email;

		return <div>
			<a href='/logout'>Log out</a>
			<p>
				Hello {displayName}!
			</p>
			<button onClick={this.onNewGame.bind(this)}>New game</button>
			<Game state={this.state.game} onAction={this.onAction.bind(this)} />
		</div>;
	}
}

whenDomReady()
.then(() => {
	ReactDOM.render(<App />, document.getElementById('container'));
});
