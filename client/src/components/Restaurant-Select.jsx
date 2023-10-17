import { useState,useEffect } from "react"
import YelpCard from "./Yelp-Card"
import YelpDescription from "./Yelp-Card-Description"
import MapComponent from "./MapComponent"

export default function RestaurantSelection() {
  const [yelpCards,setYelpCards] = useState()
  const [sortBy, setSortBy] = useState('best_match')
  const [selectedCard, setSelectedCard] = useState(0)

  useEffect(()=>{
    if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(getBusinesses)
  }
  function getBusinesses(position) {
    const latitude = position.coords.latitude
    const longitude = position.coords.longitude
    console.log(position,latitude,longitude)
    const data={
      latitude: latitude,
      longitude: longitude,
      sortBy:sortBy
    }

    fetch('/api/businessesNearby', {
    method:'POST',
    headers:{
      'Content-Type': 'application/json'
    },
    body:JSON.stringify(data)
  })
  .then((res)=>res.json())
  .then((data)=>{
    setYelpCards(data.businesses)
    console.log(data)
  })
  }


},[sortBy])

let yelpCardList
let selectedBusiness
if (yelpCards) {
  yelpCardList = yelpCards.map((business,index)=> {
  let selected=false
  if (index === selectedCard) {
    selected=true
  }
  return(
  <div key={business.id} onClick={()=>setSelectedCard(index)} className={`${selected ? 'selected-card':'background-neutral'} yelp-card-container  Oswald`}>
    <YelpCard  business={business}/>
  </div>
  )
})
  selectedBusiness = yelpCards[selectedCard]
}

  return(
    <>
    <div className="display-flex flex-basis-80 padding-main">
      <div className="flex-basis-50 background-secondary scrollAuto">
        {yelpCardList}
      </div>
      <div className="flex-basis-50 background-alt scrollAuto display-flex flex-direction-column">
        <div className="map-container flex-basis-50">
          {yelpCards ?
          <>
          <MapComponent yelpCards={yelpCards} selectedCard={selectedCard}/>
          <YelpDescription business={selectedBusiness} />
          </>:
          <div>loading</div> }
        </div>
      </div>
    </div>
    </>
  )
}
