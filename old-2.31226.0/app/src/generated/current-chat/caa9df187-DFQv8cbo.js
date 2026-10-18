// Extracted from installed Claude Desktop 2.31226.0. Do not edit.
import { messageDescriptors as m } from "../../source-artifact-adapters.jsx";
var C=m({copied:{defaultMessage:"Copied",id:"p556q3ugKt"},remove:{defaultMessage:"Remove trigger",id:"tI/F9HLxFw"},removeApiLocked:{defaultMessage:"Delete the token to remove",id:"y3jojcF/fX"}});
var w=C;
var D=m({selectTrigger:{defaultMessage:"Select a trigger",id:"/3L3D6NOeD"},schedule:{defaultMessage:"Schedule",id:"5uxnsaC/s4"},scheduleDescRunOnce:{defaultMessage:"Run on a recurring cron schedule or once at a future time",id:"+wEURn5ai5"},scheduleDesc:{defaultMessage:"Run on a recurring cron schedule",id:"OfNdFR7/Ln"},github:{defaultMessage:"GitHub event",id:"/ksFsEcFA8"},githubDesc:{defaultMessage:"Run when a GitHub webhook event fires",id:"8XT9DlI8n6"},api:{defaultMessage:"API",id:"xwEc8KM8zK"},apiDesc:{defaultMessage:"Trigger from your own code by sending a POST request",id:"2eHmKFyJSw"},apiEnabled:{defaultMessage:"Token will be generated when you save.",id:"vrtdnoFTvK"},apiSummary:{defaultMessage:"Call via API",id:"AXqqhIQt5A"},needRepo:{defaultMessage:"Select a repository first",id:"9y9sT1SK45"},alreadyAdded:{defaultMessage:"Already added",id:"ucLgKRVXpW"},addAnother:{defaultMessage:"Add another trigger",id:"8/IC6osFaz"},onRepo:{defaultMessage:"on {repo}",id:"Urxv0rSqsj"}});
var O=[{type:"schedule",icon:"Clock",title:D.schedule,desc:D.scheduleDesc},{type:"github",icon:"GitPullRequest",title:D.github,desc:D.githubDesc},{type:"api",icon:"Code",title:D.api,desc:D.apiDesc}];
var k=O.filter(e=>e.type==="schedule");

export { k, O, D, w, C, m };
