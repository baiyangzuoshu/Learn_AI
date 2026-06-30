export default class DelayCall extends cc.Component {
    static call(ms: number, callback: () => void) {
        function delay(ms: number) {
            return new Promise(resolve => setTimeout(resolve, ms));
        }

        (async () => {
            await delay(ms);
            callback();
        })();
    }
}
