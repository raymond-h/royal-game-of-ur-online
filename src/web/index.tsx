import deepstream = require('deepstream.io-client-js');
import React = require('react');
import ReactDOM = require('react-dom');
import Rx = require('rxjs/Rx');
import whenDomReady = require('when-dom-ready');

import { Game } from './game';

const client = deepstream(process.env.DEEPSTREAM_URL).login();

function fromDsRecord(recordName: string, triggerImmediately: boolean): Rx.Observable<any> {
	return Rx.Observable.fromEventPattern(
		handler => {
			const record = client.record.getRecord(recordName);
			record.subscribe((handler as (data: any) => void), triggerImmediately);
			return record;
		},
		(handler, record) => {
			record.unsubscribe(handler);
			record.discard();
		}
	);
}

const hashObs = Rx.Observable.fromEvent(window, 'hashchange')
	.map(() => location.hash)
	.startWith(location.hash);

const gameStateObs = hashObs
	.map(hash => /#?(.+)/.exec(hash))
	.map(hash => (hash != null) ? hash[1] : '')
	.distinctUntilChanged()
	.switchMap(hash => {
		if(hash === '') {
			return Rx.Observable.of({ game: null, gameId: null } as any);
		}
		else {
			return fromDsRecord(`game/${hash}`, true)
				.map(game => ({ game, gameId: hash } as any));
		}
	});

class App extends React.Component<any, any> {
	subscription: Rx.Subscription;

	constructor(props) {
		super(props);

		this.state = { game: null, gameId: null };
	}

	componentDidMount() {
		this.subscription = 
			gameStateObs.subscribe(data => this.setState(data));
	}

	componentWillUnmount() {
		this.subscription.unsubscribe();
	}

	onNewGame() {
		client.rpc.make('newGame', undefined, (err, result) => {
			if(err) {
				return alert(`Error occured when creating new game: ${err}`);
			}

			location.hash = `#${result.gameId}`;
		});
	}

	onAction(action) {
		client.rpc.make('performAction', { gameId: this.state.gameId, action }, (err, result) => {
			if(err) {
				return alert(`Error occured when performing action: ${err}`);
			}

			console.log('action went ok brah');
		});
	}

	render() {
		return <div>
			<p>
				Hello!
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
