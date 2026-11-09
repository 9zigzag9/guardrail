const TEAM = [
  { name: 'Zahara Rashini Amarasiri Gunawardana', email: '101233292@student.swin.edu.au', img: '/images/Catpic1.jpg' },
  { name: 'Le Thuy Duong Nguyen', email: '105080751@student.swin.edu.au', img: '/images/Catpic2.jpg' },
  { name: 'Tomas Agustin Cornejo Beltran', email: '105320237@student.swin.edu.au', img: '/images/Catpic3.jpg' },
];

export default function About() {
  return (
    <>
      <section className="about-header" id="about-header">
        <p className="eyebrow">Who we are</p>
        <h2>About our project</h2>
      </section>

      <section className="content" id="content">
        <p>
          We have decided to create a webpage with an AI capable of detecting prompt injections, giving instant
          feedback to the user about how much of their inserted text can be flagged as a prompt injection attempt
          in comparison to our dataset.
        </p>
      </section>

      <section className="our-team" id="our-team">
        <h2>Our Team</h2>
        <ul className="pictures-placeholders" id="pictures-placeholders">
          {TEAM.map((m, i) => (
            <li className="team-member" id={`team-member-${i + 1}`} key={m.email}>
              <img src={m.img} alt={`Team member ${i + 1}`} />
              <p>{m.name}</p>
              <a href={`mailto:${m.email}`}>{m.email}</a>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
